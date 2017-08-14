import {
  AfterContentChecked,
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  OnChanges,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

import {AudioNavigationComponent, AudioviewerComponent} from '../../core/component';

import {
  AudioService,
  KeymappingService,
  MessageService,
  TranscriptionService,
  UserInteractionsService
} from '../../core/shared/service';

import {AudioSelection, AudioTime, AVMousePos, Functions} from '../../core/shared';
import {SubscriptionManager} from '../../core/obj/SubscriptionManager';
import {SettingsService} from '../../core/shared/service/settings.service';
import {AppStorageService} from '../../core/shared/service/appstorage.service';
import {CircleLoupeComponent} from '../../core/component/circleloupe/circleloupe.component';
import {AudioManager} from '../../core/obj/media/audio/AudioManager';
import {AudioChunk} from '../../core/obj/media/audio/AudioChunk';
import {TranscrWindowComponent} from './transcr-window/transcr-window.component';
import {PlayBackState} from '../../core/obj/media/index';
import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';

@Component({
  selector: 'app-overlay-gui',
  templateUrl: './2D-editor.component.html',
  styleUrls: ['./2D-editor.component.css']
})
export class TwoDEditorComponent implements OnInit, AfterViewInit, AfterContentChecked, OnChanges, OnDestroy {
  public static editorname = '2D-Editor';

  public static initialized: EventEmitter<void> = new EventEmitter<void>();

  @ViewChild('viewer') viewer: AudioviewerComponent;
  @ViewChild('window') window: TranscrWindowComponent;
  @ViewChild('loupe') loupe: CircleLoupeComponent;
  @ViewChild('audionav') audionav: AudioNavigationComponent;
  @ViewChild('audionav') nav: ElementRef;

  public showWindow = false;
  private subscrmanager: SubscriptionManager;

  public loupe_hidden = true;
  private mousestartmoving = false;
  private loupe_updated = true;
  private intervalID = null;
  public selected_index: number;

  private factor = 4;
  public mini_loupecoord: any = {
    x: 0,
    y: 0
  };

  private scrolltimer: Subscription = null;

  public get getHeight(): number {
    return window.innerHeight - 350;
  }

  private shortcuts: any = {};

  public get app_settings(): any {
    return this.settingsService.app_settings;
  }

  public get projectsettings(): any {
    return this.settingsService.projectsettings;
  }

  public audiomanager: AudioManager;
  public audiochunk_lines: AudioChunk;
  public audiochunk_window: AudioChunk;
  public audiochunk_loupe: AudioChunk;

  constructor(public transcrService: TranscriptionService,
              public keyMap: KeymappingService,
              public audio: AudioService,
              public uiService: UserInteractionsService,
              public cd: ChangeDetectorRef,
              public msg: MessageService,
              public settingsService: SettingsService,
              public sessService: AppStorageService) {

    this.subscrmanager = new SubscriptionManager();
  }

  ngOnInit() {
    this.audiomanager = this.audio.audiomanagers[0];
    this.audiochunk_lines = this.audiomanager.mainchunk.clone();
    this.audiochunk_loupe = this.audiomanager.mainchunk.clone();
    this.audiochunk_window = this.audiomanager.mainchunk.clone();
    this.shortcuts = this.keyMap.register('2D-Editor', this.viewer.Settings.shortcuts);

    this.viewer.Settings.multi_line = true;
    this.viewer.Settings.height = 70;
    this.viewer.Settings.margin.bottom = 5;
    this.viewer.Settings.margin.right = 0;
    this.viewer.Settings.justifySignalHeight = false;
    this.viewer.Settings.step_width_ratio = (this.viewer.Settings.pixel_per_sec / this.audiomanager.ressource.info.samplerate);

    this.viewer.alerttriggered.subscribe(
      (result) => {
        this.msg.showMessage(result.type, result.message);
      }
    );

    this.subscrmanager.add(this.keyMap.onkeydown.subscribe(
      (obj) => {
        const event = obj.event;
        if (this.viewer.focused) {
          if (event.key === '+') {
            this.factor = Math.min(8, this.factor + 1);
            this.changeArea(this.loupe, this.mini_loupecoord, this.factor);
          } else if (event.key === '-') {
            if (this.factor > 3) {
              this.factor = Math.max(1, this.factor - 1);
              this.changeArea(this.loupe, this.mini_loupecoord, this.factor);
            }
          }
        }
      }
    ));

    this.subscrmanager.add(this.audiochunk_lines.statechange.subscribe(
      (state: PlayBackState) => {
        if (state === PlayBackState.PLAYING) {
          this.scrolltimer = Observable.interval(1000).subscribe(() => {
            const absx = this.viewer.av.audioTCalculator.samplestoAbsX(this.audiochunk_lines.playposition.samples);
            const specialheight = jQuery('#special').height();
            let y = Math.floor(absx / this.viewer.innerWidth) * this.viewer.Settings.height;
            y += 10 + (Math.floor(absx / this.viewer.innerWidth) * this.viewer.Settings.margin.bottom);

            if (y > specialheight) {
              Functions.scrollTo(y, '#special');
            }
          });
        } else {
          if (this.scrolltimer !== null) {
            this.scrolltimer.unsubscribe();
          }
        }
      }
    ));


    TwoDEditorComponent.initialized.emit();
  }

  ngOnChanges(test) {
  }

  ngOnDestroy() {
    clearInterval(this.intervalID);
    this.subscrmanager.destroy();
    if (this.scrolltimer !== null) {
      this.scrolltimer.unsubscribe();
    }
  }

  ngAfterViewInit() {
    if (this.audiochunk_lines.channel) {
      this.viewer.initialize();
    }

    this.subscrmanager.add(
      this.transcrService.segmentrequested.subscribe(
        (segnumber: number) => {
          this.openSegment(segnumber);
        }
      )
    );

    this.loupe.zoomY = this.factor;
    this.intervalID = setInterval(() => {
      if (!this.mousestartmoving && !this.loupe_updated) {
        this.loupe_updated = true;
        this.changeArea(this.loupe, this.mini_loupecoord, this.factor);
      }
    }, 200);
  }

  ngAfterContentChecked() {
  }

  onSegmentEntered(selected: any) {
    if (this.transcrService.currentlevel.segments && selected.index > -1 &&
      selected.index < this.transcrService.currentlevel.segments.length) {
      const segment = this.transcrService.currentlevel.segments.get(selected.index);
      const start: AudioTime = (selected.index > 0) ? this.transcrService.currentlevel.segments.get(selected.index - 1).time.clone()
        : new AudioTime(0, this.audiomanager.ressource.info.samplerate);
      if (segment) {
        this.selected_index = selected.index;
        this.audiochunk_window = new AudioChunk(new AudioSelection(start, segment.time.clone()), this.audiomanager);
      }
    }

    this.viewer.deactivate_shortcuts = true;
    this.viewer.focused = false;
    this.showWindow = true;
  }

  onWindowAction(state) {
    if (state === 'close') {
      this.showWindow = false;
      this.viewer.deactivate_shortcuts = false;
      this.viewer.drawSegments();
    } else if (state === 'open') {
    }
  }

  onSegmentSelected(selection: AudioSelection) {
  }

  onMouseOver(cursor: AVMousePos) {
    this.mousestartmoving = true;
    this.loupe_updated = false;
    if (!this.audiomanager.audioplaying && this.sessService.playonhover) {
      // play audio
      this.audiochunk_lines.selection.start.samples = this.viewer.av.Mousecursor.timePos.samples;
      this.audiochunk_lines.selection.end.samples = this.viewer.av.Mousecursor.timePos.samples +
        this.audiomanager.ressource.info.samplerate / 10;
      this.audiochunk_lines.startPlayback(() => {
      }, true);
    }
    setTimeout(() => {
      this.mousestartmoving = false;
    }, 200);
    this.changePosition(this.mini_loupecoord);
  }

  onSegmentChange($event) {
  }

  private changeArea(loup: CircleLoupeComponent, coord: any, factor: number) {
    const cursor = this.viewer.MouseCursor;

    if (cursor && cursor.timePos && cursor.relPos) {
      coord.x = ((cursor.relPos.x) ? cursor.relPos.x - 40 : 0);
      coord.y = ((cursor.line) ? (cursor.line.number) *
        cursor.line.Size.height + (cursor.line.number) * this.viewer.Settings.margin.bottom : 0);
      coord.y += this.viewer.Settings.height - 15;

      const half_rate = Math.round(this.audiomanager.ressource.info.samplerate / factor);
      const start = (cursor.timePos.samples > half_rate)
        ? new AudioTime(cursor.timePos.samples - half_rate, this.audiomanager.ressource.info.samplerate)
        : new AudioTime(0, this.audiomanager.ressource.info.samplerate);
      const end = (cursor.timePos.samples < this.audiomanager.ressource.info.duration.samples - half_rate)
        ? new AudioTime(cursor.timePos.samples + half_rate, this.audiomanager.ressource.info.samplerate)
        : this.audiomanager.ressource.info.duration.clone();

      this.loupe.zoomY = factor;
      if (start && end) {
        this.audiochunk_loupe = new AudioChunk(new AudioSelection(start, end), this.audiomanager);
      }
    }
  }

  private changePosition(coord: any) {
    const cursor = this.viewer.MouseCursor;

    if (cursor && cursor.timePos && cursor.relPos) {
      coord.x = ((cursor.relPos.x) ? cursor.relPos.x - 40 : 0);
      coord.y = ((cursor.line) ? (cursor.line.number) *
        cursor.line.Size.height + (cursor.line.number) * this.viewer.Settings.margin.bottom : 0);
      coord.y += this.viewer.Settings.height - 15;
    }
  }

  onShortCutTriggered($event, type) {
    if (
      $event.value === null || !(
        // cursor move by keyboard events are note saved because this would be too much
        Functions.contains($event.value, 'cursor') ||
        // disable logging for user test phase, because it would be too much
        Functions.contains($event.value, 'play_selection') ||
        Functions.contains($event.value, 'segment_enter') ||
        Functions.contains($event.value, 'playonhover')
      )
    ) {
      this.uiService.addElementFromEvent('shortcut', $event, Date.now(), type);
    } else if ($event.value !== null && Functions.contains($event.value, 'playonhover')) {
      this.sessService.playonhover = !this.sessService.playonhover;
    }
  }

  onMarkerInsert(marker_code: string) {
    if (this.projectsettings.logging.forced === true) {
      this.uiService.addElementFromEvent('marker_insert', {value: marker_code}, Date.now(), 'editor');
    }
  }

  onMarkerClick(marker_code: string) {
    if (this.projectsettings.logging.forced === true) {
      this.uiService.addElementFromEvent('marker_click', {value: marker_code}, Date.now(), 'editor');
    }
  }

  onSpeedChange(event: { old_value: number, new_value: number, timestamp: number }) {
    this.audiochunk_lines.speed = event.new_value;
  }

  afterSpeedChange(event: { new_value: number, timestamp: number }) {
    if (this.projectsettings.logging.forced === true) {
      this.uiService.addElementFromEvent('slider', event, event.timestamp, 'speed_change');
    }
  }

  onVolumeChange(event: { old_value: number, new_value: number, timestamp: number }) {
    this.audiochunk_lines.volume = event.new_value;
  }

  afterVolumeChange(event: { new_value: number, timestamp: number }) {
    if (this.projectsettings.logging.forced === true) {
      this.uiService.addElementFromEvent('slider', event, event.timestamp, 'volume_change');
    }
  }

  onButtonClick(event: { type: string, timestamp: number }) {
    if (this.projectsettings.logging.forced === true) {
      this.uiService.addElementFromEvent('mouse_click', {}, event.timestamp, event.type + '_button');
    }

    switch (event.type) {
      case('play'):
        this.viewer.startPlayback();
        break;
      case('pause'):
        this.viewer.pausePlayback();
        break;
      case('stop'):
        this.viewer.stopPlayback();
        break;
      case('replay'):
        this.audionav.replay = this.viewer.rePlayback();
        break;
      case('backward'):
        this.viewer.stepBackward();
        break;
      case('backward time'):
        this.viewer.stepBackwardTime(0.5);
        break;
      case('default'):
        break;
    }
  }

  public openSegment(segnumber: number) {
    const segment = this.transcrService.currentlevel.segments.get(segnumber);
    this.selectSegment({
      index: segnumber,
      pos: segment.time.samples
    });
  }

  public update() {
    this.viewer.update();
    this.audiochunk_lines.startpos = this.audiochunk_lines.time.start;
  }

  public selectSegment(selected: any) {
    const segment = this.transcrService.currentlevel.segments.get(selected.index);
    if (this.transcrService.currentlevel.segments && selected.index > -1 &&
      selected.index < this.transcrService.currentlevel.segments.length) {
      if (segment) {
        const start = (selected.index > 0) ? this.transcrService.currentlevel.segments.get(selected.index - 1).time
          : new AudioTime(0, this.audiomanager.ressource.info.samplerate);
        const end = start.clone();
        end.samples = start.samples + segment.time.samples;
        this.audiochunk_window = new AudioChunk(new AudioSelection(start, end), this.audiomanager);
        this.selected_index = selected.index;
      }
    }
    this.viewer.deactivate_shortcuts = true;
    this.viewer.focused = false;
    this.showWindow = true;
  }
}
