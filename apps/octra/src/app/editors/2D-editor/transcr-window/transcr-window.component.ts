import {
  AfterContentInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { getProperties, ShortcutEvent, ShortcutGroup } from '@octra/utilities';
import { TranscrEditorComponent } from '../../../core/component/transcr-editor';

import {
  AudioService,
  KeymappingService,
  SettingsService,
  TranscriptionService,
  UserInteractionsService,
} from '../../../core/shared/service';
import { AppStorageService } from '../../../core/shared/service/appstorage.service';
import {
  AudioChunk,
  AudioManager,
  AudioRessource,
  AudioSelection,
  SampleUnit,
} from '@octra/media';
import {
  addSegment,
  ASRQueueItemType,
  getSegmentBySamplePosition,
  Segment,
} from '@octra/annotation';
import {
  AudioViewerComponent,
  AudioViewerShortcutEvent,
} from '@octra/ngx-components';
import { LoginMode } from '../../../core/store';
import { timer } from 'rxjs';
import { AudioNavigationComponent } from '../../../core/component/audio-navigation';
import { DefaultComponent } from '../../../core/component/default.component';

@Component({
  selector: 'octra-transcr-window',
  templateUrl: './transcr-window.component.html',
  styleUrls: ['./transcr-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TranscrWindowComponent
  extends DefaultComponent
  implements OnInit, AfterContentInit, AfterViewInit, OnChanges
{
  @ViewChild('loupe', { static: true }) loupe!: AudioViewerComponent;
  @ViewChild('editor', { static: true }) editor!: TranscrEditorComponent;
  @ViewChild('audionav', { static: true }) audionav!: AudioNavigationComponent;
  @ViewChild('window', { static: true }) window!: ElementRef;
  @ViewChild('main', { static: true }) main!: ElementRef;
  @Output() act: EventEmitter<string> = new EventEmitter<string>();
  @Input() easymode = false;
  @Input() audiochunk!: AudioChunk;
  @Input() segmentIndex!: number;

  private showWindow = false;
  private tempSegments!: Segment[];
  private oldRaw = '';

  @Output()
  get shortcuttriggered(): EventEmitter<AudioViewerShortcutEvent> {
    return this.loupe.shortcutTrigger;
  }

  @Output()
  get marker_insert(): EventEmitter<string> {
    return this.editor.markerInsert;
  }

  @Output()
  get marker_click(): EventEmitter<string> {
    return this.editor.markerClick;
  }

  get app_settings(): any {
    return this.settingsService.appSettings;
  }

  get projectsettings(): any {
    return this.settingsService.projectsettings;
  }

  get responsive(): boolean {
    return this.settingsService.responsive.enabled;
  }

  get audioManager(): AudioManager {
    return this.audiochunk.audioManager;
  }

  get ressource(): AudioRessource {
    return this.audiochunk.audioManager.resource;
  }

  public get hasSegmentBoundaries() {
    return this.editor.rawText.match(/{[0-9]+}/) !== undefined;
  }

  private _validationEnabled = false;

  get validationEnabled(): boolean {
    return this._validationEnabled;
  }

  private _loading = false;

  get loading(): boolean {
    return this._loading;
  }

  public get mainSize(): {
    width: number;
    height: number;
  } {
    if (this.main !== undefined) {
      return {
        width: this.main.nativeElement.clientWidth,
        height: this.main.nativeElement.clientHeight,
      };
    } else {
      return {
        width: 0,
        height: 0,
      };
    }
  }

  private audioShortcuts: ShortcutGroup = {
    name: '',
    enabled: true,
    items: [
      {
        name: 'play_pause',
        keys: {
          mac: 'TAB',
          pc: 'TAB',
        },
        title: 'play pause',
        focusonly: false,
      },
      {
        name: 'stop',
        keys: {
          mac: 'ESC',
          pc: 'ESC',
        },
        title: 'stop playback',
        focusonly: false,
      },
      {
        name: 'step_backward',
        keys: {
          mac: 'SHIFT + BACKSPACE',
          pc: 'SHIFT + BACKSPACE',
        },
        title: 'step backward',
        focusonly: false,
      },
      {
        name: 'step_backwardtime',
        keys: {
          mac: 'SHIFT + TAB',
          pc: 'SHIFT + TAB',
        },
        title: 'step backward time',
        focusonly: false,
      },
    ],
  };

  public transcript = '';

  constructor(
    public keyMap: KeymappingService,
    public transcrService: TranscriptionService,
    public audio: AudioService,
    public uiService: UserInteractionsService,
    public settingsService: SettingsService,
    public appStorage: AppStorageService,
    public cd: ChangeDetectorRef
  ) {
    super();

    if (
      this.appStorage.useMode === LoginMode.ONLINE ||
      this.appStorage.useMode === LoginMode.DEMO
    ) {
      this.subscrManager.add(
        this.keyMap.beforeShortcutTriggered.subscribe(
          (event: ShortcutEvent) => {
            if (
              event.shortcut === 'SHIFT + ALT + 1' ||
              event.shortcut === 'SHIFT + ALT + 2' ||
              event.shortcut === 'SHIFT + ALT + 3'
            ) {
              this.transcrService.tasksBeforeSend.push(
                new Promise<void>((resolve) => {
                  this.save();

                  if (this.oldRaw === this.editor.rawText) {
                    this.appStorage.saving.emit('success');
                  }

                  this.close();
                  resolve();
                })
              );
            }
          }
        )
      );
    }

    /* TODO implement
    this.subscrManager.add(
      this.asrService.queue.itemChange.subscribe(
        (item: ASRQueueItem) => {
          if (
            item.time.sampleStart === this.audiochunk.time.start.samples &&
            item.time.sampleLength === this.audiochunk.time.duration.samples
          ) {
            if (
              item.status === ASRProcessStatus.FINISHED &&
              item.result !== undefined
            ) {
              this.transcript = item.result;
            }

            // TODO find a better solution
            this.loupe.redraw();

            this.cd.markForCheck();
            this.cd.detectChanges();
          }
        },
        (error) => {
          console.error(error);
        }
      )
    );

     */
  }

  public doDirectionAction = (direction: string) => {
    this._loading = true;
    this.cd.markForCheck();
    this.cd.detectChanges();

    new Promise<void>((resolve) => {
      // timeout to show loading status correctly
      this.subscrManager.add(
        timer(0).subscribe(() => {
          this._validationEnabled = false;
          this.editor.updateRawText();
          this.save();
          this.setValidationEnabledToDefault();

          if (this.audioManager.isPlaying) {
            this.audiochunk.stopPlayback().then(() => {
              resolve();
            });
          } else {
            resolve();
          }
        })
      );
    }).then(() => {
      if (direction !== 'down') {
        this.goToSegment(direction)
          .then(() => {
            const segment =
              this.transcrService.currentlevel!.segments[this.segmentIndex];

            if (segment?.isBlockedBy === undefined) {
              this.audiochunk.startPlayback().catch((error) => {
                console.error(error);
              });
            }
            this.cd.markForCheck();
            this.cd.detectChanges();
          })
          .catch((error) => {
            console.error(error);
          });
      } else {
        this.close();
      }
      this._loading = false;
    });
  };

  onShortcutTriggered = ($event: ShortcutEvent) => {
    if (!this.loading) {
      switch ($event.shortcutName) {
        case 'play_pause':
          this.triggerUIAction({
            shortcut: $event.shortcut,
            shortcutName: $event.shortcutName,
            value: $event.shortcutName,
            type: 'audio',
            timestamp: $event.timestamp,
          });
          if (this.audiochunk.isPlaying) {
            this.audiochunk.pausePlayback().catch((error) => {
              console.error(error);
            });
          } else {
            this.audiochunk.startPlayback(false).catch((error) => {
              console.error(error);
            });
          }
          break;
        case 'stop':
          this.triggerUIAction({
            shortcut: $event.shortcut,
            shortcutName: $event.shortcutName,
            value: $event.shortcutName,
            type: 'audio',
            timestamp: $event.timestamp,
          });
          this.audiochunk.stopPlayback().catch((error) => {
            console.error(error);
          });
          break;
        case 'step_backward':
          this.triggerUIAction({
            shortcut: $event.shortcut,
            shortcutName: $event.shortcutName,
            value: $event.shortcutName,
            type: 'audio',
            timestamp: $event.timestamp,
          });
          this.audiochunk.stepBackward().catch((error) => {
            console.error(error);
          });
          break;
        case 'step_backwardtime':
          this.triggerUIAction({
            shortcut: $event.shortcut,
            shortcutName: $event.shortcutName,
            value: $event.shortcutName,
            type: 'audio',
            timestamp: $event.timestamp,
          });
          this.audiochunk.stepBackwardTime(0.5).catch((error) => {
            console.error(error);
          });
          break;
        case 'jump_right':
          if (
            this.hasSegmentBoundaries ||
            (!this.isNextSegmentLastAndBreak(this.segmentIndex) &&
              this.segmentIndex <
                this.transcrService.currentlevel!.segments.length - 1)
          ) {
            this.doDirectionAction('right');
          } else {
            this.save();
            this.close();
            this.act.emit('overview');
          }
          break;
        case 'jump_left':
          this.doDirectionAction('left');
          break;
        case 'close_save':
          this.doDirectionAction('down');
          break;
      }
    }
  };

  ngOnInit() {
    this._loading = false;
    this.setValidationEnabledToDefault();

    this.editor.settings.markers = this.transcrService.guidelines.markers;
    this.editor.settings.responsive = this.settingsService.responsive.enabled;
    this.editor.settings.specialMarkers.boundary = true;
    this.loupe.name = 'transcr-window viewer';
    this.loupe.settings.margin.top = 5;
    this.loupe.settings.margin.bottom = 0;
    this.loupe.settings.lineheight = 200;
    this.loupe.settings.justifySignalHeight = true;
    this.loupe.settings.boundaries.enabled = false;
    this.loupe.settings.boundaries.readonly = true;
    this.loupe.settings.selection.enabled = true;
    this.loupe.settings.frame.color = '#222222';
    this.loupe.settings.roundValues = false;
    this.loupe.settings.showTimePerLine = true;
    this.loupe.settings.showProgressBars = true;
    this.loupe.settings.multiLine = false;
    this.loupe.av.drawnSelection = undefined;

    this.tempSegments = [...this.transcrService.currentlevel!.segments];
    this.subscrManager.removeByTag('editor');
    if (
      this.segmentIndex > -1 &&
      this.transcrService.currentlevel!.segments &&
      this.segmentIndex < this.transcrService.currentlevel!.segments.length
    ) {
      this.transcript =
        this.transcrService.currentlevel!.segments[this.segmentIndex].value;
    }

    const shortcutGroup =
      this.keyMap.shortcutsManager.getShortcutGroup('2D-Editor viewer');
    shortcutGroup!.enabled = false;

    this.cd.markForCheck();
    this.cd.detectChanges();

    this.subscrManager.add(
      this.keyMap.onShortcutTriggered.subscribe(this.onShortcutTriggered)
    );
  }

  setValidationEnabledToDefault() {
    this._validationEnabled =
      this.appStorage.useMode !== 'url' &&
      (this.appStorage.useMode === 'demo' ||
        this.settingsService?.projectsettings?.octra?.validationEnabled ===
          true);
  }

  ngOnChanges(obj: SimpleChanges) {
    if (getProperties(obj).findIndex(([key]) => key === 'audiochunk') > -1) {
      const previous: AudioChunk = obj['audiochunk'].previousValue;
      const current: AudioChunk = obj['audiochunk'].currentValue;

      if (
        (previous === undefined && current !== undefined) ||
        (current.time.start.samples !== previous.time.start.samples &&
          current.time.end.samples !== previous.time.end.samples)
      ) {
        // audiochunk changed
        this.listenToAudioChunkStatusChanges();

        this.setValidationEnabledToDefault();
      }
    }
  }

  ngAfterViewInit() {
    this.loupe.av.zoomY = 6;
    this.audiochunk.startpos = this.audiochunk.time.start.clone();
    this.loupe.av.drawnSelection = new AudioSelection(
      this.audioManager.createSampleUnit(0),
      this.audioManager.createSampleUnit(0)
    );

    this.subscrManager.add(
      timer(500).subscribe(() => {
        const segment =
          this.transcrService.currentlevel!.segments[this.segmentIndex];

        if (segment!.isBlockedBy === undefined) {
          this.audiochunk.startPlayback().catch((error) => {
            console.error(error);
          });
        }
      })
    );
    this.editor.focus(true, true);
  }

  ngAfterContentInit() {
    this.act.emit('open');
  }

  close() {
    this.showWindow = false;

    const shortcutGroup =
      this.keyMap.shortcutsManager.getShortcutGroup('2D-Editor viewer');
    shortcutGroup!.enabled = true;

    const startSample =
      this.segmentIndex > 0
        ? this.transcrService.currentlevel!.segments[this.segmentIndex - 1].time
            .samples
        : 0;

    this.uiService.addElementFromEvent(
      'segment',
      {
        value: 'exited',
      },
      Date.now(),
      this.loupe.av.PlayCursor!.timePos,
      -1,
      undefined,
      {
        start: startSample,
        length:
          this.transcrService.currentlevel!.segments[this.segmentIndex]!.time
            .samples - startSample,
      },
      'transcription window'
    );

    this.act.emit('close');
  }

  public open() {
    this.showWindow = true;
  }

  openOverview() {
    this.act.emit('overview');
  }

  save() {
    this.saveTranscript();

    if (
      this.segmentIndex > -1 &&
      this.transcrService.currentlevel!.segments &&
      this.segmentIndex < this.transcrService.currentlevel!.segments.length
    ) {
      if (
        this.editor.html.indexOf(
          '<img src="assets/img/components/transcr-editor/boundary.png"'
        ) > -1
      ) {
        // boundaries were inserted
        this.transcrService.currentlevel!.segments = this.tempSegments;
      } else {
        // no boundaries inserted
        const segment =
          this.transcrService.currentlevel!.segments[
            this.segmentIndex
          ]!.clone();
        this.editor.updateRawText();
        segment.value = this.editor.rawText;
        segment.isBlockedBy =
          this.transcrService.currentlevel!.segments[
            this.segmentIndex
          ].isBlockedBy;
        this.transcrService.currentlevel!.segments[this.segmentIndex] = segment;
        this.transcrService.saveSegments();
      }
    } else {
      const isNull = this.transcrService.currentlevel!.segments === undefined;
    }
  }

  onButtonClick(event: { type: string; timestamp: number }) {
    if (this.appStorage.logging) {
      const segment = {
        start: -1,
        length: 0,
      };

      if (this.segmentIndex > -1) {
        const annoSegment =
          this.transcrService.currentlevel!.segments[this.segmentIndex];
        segment.start = 0;
        if (this.segmentIndex > 0) {
          segment.start =
            this.transcrService.currentlevel!.segments[
              this.segmentIndex - 1
            ].time.samples;
        }

        segment.length = annoSegment!.time.samples - segment.start;

        segment.start = Math.round(segment.start);
        segment.length = Math.round(segment.length);
      }

      let selection = undefined;
      if (
        this.loupe.av.drawnSelection!.start.samples >= segment.start &&
        this.loupe.av.drawnSelection!.end.samples <=
          segment.start + segment.length
      ) {
        selection = {
          start: this.loupe.av.drawnSelection!.start.samples,
          length: this.loupe.av.drawnSelection!.duration.samples,
        };
      }

      this.uiService.addElementFromEvent(
        'mouseclick',
        { value: event.type },
        event.timestamp,
        this.audioManager.playPosition,
        this.editor.caretpos,
        selection,
        segment,
        'audio_buttons'
      );
    }

    // TODO important what about this?
    // this.loupe.onButtonClick(event);
  }

  /**
   * selects the next segment on the left or on the right side
   */
  goToSegment(direction: string) {
    return new Promise<void>((resolve, reject) => {
      this.editor.isTyping = false;

      if (
        this.segmentIndex > -1 &&
        this.transcrService.currentlevel!.segments &&
        this.segmentIndex < this.transcrService.currentlevel!.segments.length
      ) {
        const segmentsLength =
          this.transcrService.currentlevel!.segments.length;

        let segment: Segment | undefined = undefined;

        let startIndex = 0;
        let limitFunc: (i: number) => boolean = (i) => true;
        let counterFunc: (i: number) => number = (i) => i;
        let appliedDirection = '';

        if (direction === 'right' && this.segmentIndex < segmentsLength - 1) {
          startIndex = this.segmentIndex + 1;
          limitFunc = (j) => j < segmentsLength;
          counterFunc = (j) => j + 1;
          appliedDirection = 'right';
        } else if (direction === 'left' && this.segmentIndex > 0) {
          startIndex = this.segmentIndex - 1;
          limitFunc = (j) => j >= 0;
          counterFunc = (j) => j - 1;
          appliedDirection = 'left';
        }

        if (appliedDirection !== '') {
          for (let i = startIndex; limitFunc(i); i = counterFunc(i)) {
            const tempSegment = this.transcrService.currentlevel!.segments[i];

            if (
              tempSegment!.value !== this.transcrService.breakMarker.code &&
              tempSegment!.isBlockedBy !== ASRQueueItemType.ASRMAUS &&
              tempSegment!.isBlockedBy !== ASRQueueItemType.MAUS
            ) {
              segment = tempSegment;
              this.segmentIndex = i;
              break;
            }
          }

          const start =
            this.segmentIndex > 0
              ? this.transcrService.currentlevel!.segments[
                  this.segmentIndex - 1
                ].time.samples
              : 0;
          const valueString =
            appliedDirection === 'right' ? 'entered next' : 'entered previous';
          this.uiService.addElementFromEvent(
            'segment',
            { value: valueString },
            Date.now(),
            this.audioManager.playPosition,
            this.editor.caretpos,
            undefined,
            {
              start,
              length:
                this.transcrService.currentlevel!.segments[this.segmentIndex]
                  .time.samples - start,
            },
            'transcription window'
          );
        }

        let begin;
        if (this.segmentIndex > 0) {
          begin =
            this.transcrService.currentlevel!.segments[
              this.segmentIndex - 1
            ]!.time.clone();
        } else {
          begin = new SampleUnit(0, this.audioManager.sampleRate);
        }

        if (segment !== undefined) {
          this.transcript =
            this.transcrService.currentlevel!.segments[
              this.segmentIndex
            ]!.value;
          // noinspection JSObjectNullOrUndefined
          this.audiochunk = this.audioManager.createNewAudioChunk(
            new AudioSelection(begin, segment.time.clone())
          )!;

          // resolve only after the audio viewer is ready
          const subscr = this.loupe.onInitialized.subscribe(() => {
            subscr.unsubscribe();
            resolve();
          });
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    });
  }

  triggerUIAction($event: AudioViewerShortcutEvent) {
    const segment = {
      start: -1,
      length: 0,
    };

    if (this.segmentIndex > -1) {
      const annoSegment =
        this.transcrService.currentlevel!.segments[this.segmentIndex];
      segment.start = 0;
      if (this.segmentIndex > 0) {
        segment.start =
          this.transcrService.currentlevel!.segments[
            this.segmentIndex - 1
          ].time.samples;
      }

      segment.length = annoSegment!.time.samples - segment.start;

      segment.start = Math.round(segment.start);
      segment.length = Math.round(segment.length);
    }

    let selection = undefined;
    if (
      this.loupe.av.drawnSelection!.start.samples >= segment.start &&
      this.loupe.av.drawnSelection!.end.samples <=
        segment.start + segment.length
    ) {
      selection = {
        start: this.loupe.av.drawnSelection!.start.samples,
        length: this.loupe.av.drawnSelection!.duration.samples,
      };
    }

    this.uiService.addElementFromEvent(
      'shortcut',
      $event,
      $event.timestamp,
      this.audioManager.playPosition,
      this.editor.caretpos,
      selection,
      segment,
      'loupe'
    );
  }

  onMarkerInsert(markerCode: string) {
    const segment = {
      start: -1,
      length: -1,
    };

    if (this.segmentIndex > -1) {
      const annoSegment =
        this.transcrService.currentlevel!.segments[this.segmentIndex];
      segment.start = 0;
      if (this.segmentIndex > 0) {
        segment.start =
          this.transcrService.currentlevel!.segments[
            this.segmentIndex - 1
          ].time.samples;
      }

      segment.length = annoSegment!.time.samples - segment.start;

      segment.start = Math.round(segment.start);
      segment.length = Math.round(segment.length);
    }

    let selection = undefined;
    if (
      this.loupe.av.drawnSelection!.start.samples >= segment.start &&
      this.loupe.av.drawnSelection!.end.samples <=
        segment.start + segment.length
    ) {
      selection = {
        start: this.loupe.av.drawnSelection!.start.samples,
        length: this.loupe.av.drawnSelection!.duration.samples,
      };
    }

    this.uiService.addElementFromEvent(
      'shortcut',
      { value: markerCode },
      Date.now(),
      this.audioManager.playPosition,
      this.editor.caretpos,
      selection,
      segment,
      'markers'
    );
  }

  onMarkerClick(markerCode: string) {
    const segment = {
      start: -1,
      length: -1,
    };

    if (this.segmentIndex > -1) {
      const annoSegment =
        this.transcrService.currentlevel!.segments[this.segmentIndex];
      segment.start = 0;
      if (this.segmentIndex > 0) {
        segment.start =
          this.transcrService.currentlevel!.segments[
            this.segmentIndex - 1
          ].time.samples;
      }

      segment.length = annoSegment!.time.samples - segment.start;

      segment.start = Math.round(segment.start);
      segment.length = Math.round(segment.length);
    }

    let selection = undefined;
    if (
      this.loupe.av.drawnSelection!.start.samples >= segment.start &&
      this.loupe.av.drawnSelection!.end.samples <=
        segment.start + segment.length
    ) {
      selection = {
        start: this.loupe.av.drawnSelection!.start.samples,
        length: this.loupe.av.drawnSelection!.duration.samples,
      };
    }

    this.uiService.addElementFromEvent(
      'mouseclick',
      { value: markerCode },
      Date.now(),
      this.audioManager.playPosition,
      this.editor.caretpos,
      selection,
      segment,
      'texteditor_toolbar'
    );
  }

  onSpeedChange(event: {
    old_value: number;
    new_value: number;
    timestamp: number;
  }) {
    // TODO speed?
    // this.audiochunk.speed = event.new_value;
    this.appStorage.audioSpeed = event.new_value;
  }

  listenToAudioChunkStatusChanges() {
    this.subscrManager.removeByTag('audiochunkStatus');
    this.subscrManager.add(
      this.audiochunk.statuschange.subscribe(
        (status) => {
          this.cd.markForCheck();
          this.cd.detectChanges();
        },
        (error) => {
          console.error(
            `couldn't update view for audio chunk in transcription window.`
          );
          console.error(error);
        }
      ),
      'audiochunkStatus'
    );
  }

  afterSpeedChange(event: { new_value: number; timestamp: number }) {
    const segment = {
      start: -1,
      length: -1,
    };

    if (this.segmentIndex > -1) {
      const annoSegment =
        this.transcrService.currentlevel!.segments[this.segmentIndex];
      segment.start = 0;
      if (this.segmentIndex > 0) {
        segment.start =
          this.transcrService.currentlevel!.segments[
            this.segmentIndex - 1
          ].time.samples;
      }

      segment.length = annoSegment!.time.samples - segment.start;
      segment.start = Math.round(segment.start);
      segment.length = Math.round(segment.length);
    }

    let selection = undefined;
    if (
      this.loupe.av.drawnSelection!.start.samples >= segment.start &&
      this.loupe.av.drawnSelection!.end.samples <=
        segment.start + segment.length
    ) {
      selection = {
        start: this.loupe.av.drawnSelection!.start.samples,
        length: this.loupe.av.drawnSelection!.duration.samples,
      };
    }

    this.uiService.addElementFromEvent(
      'slider',
      event,
      event.timestamp,
      this.audioManager.playPosition,
      this.editor.caretpos,
      selection,
      segment,
      'audio_speed'
    );
  }

  onVolumeChange(event: {
    old_value: number;
    new_value: number;
    timestamp: number;
  }) {
    this.audiochunk.volume = event.new_value;
    this.appStorage.audioVolume = event.new_value;
  }

  afterVolumeChange(event: { new_value: number; timestamp: number }) {
    const segment = {
      start: -1,
      length: -1,
    };

    if (this.segmentIndex > -1) {
      const annoSegment =
        this.transcrService.currentlevel!.segments[this.segmentIndex];
      segment.start = 0;
      if (this.segmentIndex > 0) {
        segment.start =
          this.transcrService.currentlevel!.segments[
            this.segmentIndex - 1
          ].time.samples;
      }

      segment.length = annoSegment!.time.samples - segment.start;

      segment.start = Math.round(segment.start);
      segment.length = Math.round(segment.length);
    }

    let selection = undefined;
    if (
      this.loupe.av.drawnSelection!.start.samples >= segment.start &&
      this.loupe.av.drawnSelection!.end.samples <=
        segment.start + segment.length
    ) {
      selection = {
        start: this.loupe.av.drawnSelection!.start.samples,
        length: this.loupe.av.drawnSelection!.duration.samples,
      };
    }

    this.uiService.addElementFromEvent(
      'slider_changed',
      event,
      event.timestamp,
      this.audioManager.playPosition,
      this.editor.caretpos,
      selection,
      segment,
      'audio_volume'
    );
  }

  onBoundaryClicked(sample: SampleUnit) {
    const i: number = getSegmentBySamplePosition(
      this.transcrService.currentlevel!.segments,
      sample
    );

    if (i > -1) {
      this.audiochunk.startpos =
        i > 0
          ? this.tempSegments[i - 1].time.clone()
          : this.audioManager.createSampleUnit(0);
      this.audiochunk.selection.end = this.tempSegments[i]!.time.clone();
      this.loupe.av.drawnSelection = this.audiochunk.selection;
      this.audiochunk.startPlayback().catch((error) => {
        console.error(error);
      });
    }
  }

  onBoundaryInserted() {
    this.uiService.addElementFromEvent(
      'segment',
      { value: 'boundaries:add' },
      Date.now(),
      this.audioManager.playPosition,
      this.editor.caretpos,
      undefined,
      undefined,
      'texteditor'
    );
  }

  afterTyping(status: string) {
    if (status === 'started') {
      this.oldRaw = this.editor.rawText;
    }

    if (status === 'stopped') {
      if (this.oldRaw === this.editor.rawText) {
        // this.appStorage.savingNeeded = false;
      }

      // this.highlight();
    }
  }

  saveTranscript() {
    const segStart = getSegmentBySamplePosition(
      this.transcrService.currentlevel!.segments,
      this.audiochunk.time.start.add(
        new SampleUnit(20, this.audioManager.sampleRate)
      )
    );
    const currentSegment =
      this.transcrService.currentlevel!.segments[this.segmentIndex];

    this.tempSegments = [...this.transcrService.currentlevel!.segments];
    const html = this.editor.getRawText();
    // split text at the position of every boundary marker
    const segTexts: string[] = html.split(/\s?{[0-9]+}\s?/g);

    const samplesArray: number[] = [];
    html.replace(/\s?{([0-9]+)}\s?/g, (match, g1, g2) => {
      samplesArray.push(Number(g1));
      return '';
    });

    // remove invalid boundaries
    if (segTexts.length > 1) {
      let start = 0;
      for (let i = 0; i < samplesArray.length; i++) {
        if (!(samplesArray[i] > start)) {
          // remove boundary
          samplesArray.splice(i, 1);

          // concat
          segTexts[i + 1] = segTexts[i] + segTexts[i + 1];
          segTexts.splice(i, 1);

          --i;
        } else {
          start = samplesArray[i];
        }
      }
    }

    for (let i = 0; i < segTexts.length - 1; i++) {
      addSegment(
        this.tempSegments,
        this.audioManager.createSampleUnit(samplesArray[i]),
        currentSegment!.speakerLabel,
        segTexts[i]
      );
    }

    // shift rest of text to next segment
    if (this.tempSegments[segStart + segTexts.length - 1]) {
      this.tempSegments[segStart + segTexts.length - 1]!.value =
        segTexts[segTexts.length - 1];
    }
  }

  public highlight() {
    const html: string = this.editor.html.replace(/&nbsp;/g, ' ');

    const samplesArray: number[] = [];
    html.replace(
      new RegExp(
        /\s?<img src="assets\/img\/components\/transcr-editor\/boundary.png"[\s\w="-:;äüößÄÜÖ]*data-samples="([0-9]+)" alt="\[\|[0-9]+\|\]">\s?/,
        'g'
      ),
      (match, g1, g2) => {
        samplesArray.push(Number(g1));
        return '';
      }
    );

    let start = 0;
    for (let i = 0; i < samplesArray.length; i++) {
      const boundary = this.editor.wysiwyg?.querySelector(
        'img[data-samples]:eq(' + i + ')'
      ) as HTMLDivElement;
      if (!(samplesArray[i] > start)) {
        // mark boundary red
        if (boundary) {
          boundary.style.backgroundColor = 'red';
        }
      } else {
        if (boundary) {
          boundary.style.backgroundColor = 'transparent';
        }
        start = samplesArray[i];
      }
    }
  }

  /**
   * checks if next segment is the last one and contains only a break.
   */
  public isNextSegmentLastAndBreak(segmentIndex: number) {
    const currentLevel = this.transcrService.currentlevel;
    const nextSegment = currentLevel!.segments[segmentIndex + 1];
    return (
      segmentIndex === currentLevel!.segments.length - 2 &&
      (nextSegment!.value === this.transcrService.breakMarker.code ||
        nextSegment!.isBlockedBy === ASRQueueItemType.ASRMAUS ||
        nextSegment!.isBlockedBy === ASRQueueItemType.MAUS)
    );
  }

  public onKeyUp() {
    this.appStorage.savingNeeded = true;
  }

  somethingChanged($event: any) {}
}
