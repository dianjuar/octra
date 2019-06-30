import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {AudioviewerComponent, AudioviewerConfig, AudioviewerService} from '../audioviewer';
import {AVMousePos} from '../../../obj';
import {SubscriptionManager} from '../../../../core/obj/SubscriptionManager';
import {AudioChunk} from '../../../obj/media/audio/AudioManager';

declare var window: any;

@Component({
  selector: 'app-loupe',
  templateUrl: './loupe.component.html',
  styleUrls: ['./loupe.component.css'],
  providers: [AudioviewerService]
})
export class LoupeComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  get name(): string {
    return this._name;
  }

  @Input() set name(value: string) {
    this.viewer.name = value;
    this._name = value;
  }

  @ViewChild('viewer', {static: true}) viewer: AudioviewerComponent;
  @ViewChild('loupe', {static: true}) loupe: ElementRef;

  @Output() mousecursorchange: EventEmitter<AVMousePos> = new EventEmitter<AVMousePos>();
  @Output() shortcuttriggered: EventEmitter<string> = new EventEmitter<string>();
  @Output() segmententer: EventEmitter<any> = new EventEmitter<any>();
  @Output() alerttriggered: EventEmitter<{ type: string, message: string }>
    = new EventEmitter<{ type: string, message: string }>();

  @Input() audiochunk: AudioChunk;
  @Input() height: number;

  private _name: string;
  public pos: any = {
    x: 0,
    y: 0
  };
  private subscrmanager;

  public get zoomY(): number {
    return this.viewer.av.zoomY;
  }

  public set zoomY(value: number) {
    this.viewer.av.zoomY = value;
  }

  public get focused(): boolean {
    return this.viewer.focused;
  }

  public get MouseCursor(): AVMousePos {
    return this.viewer.MouseCursor;
  }

  public get margin(): any {
    return this.viewer.margin;
  }

  @Input()
  public set margin(value: any) {
    this.viewer.margin = value;
  }

  get Settings(): AudioviewerConfig {
    return this.viewer.Settings;
  }

  @Input()
  set Settings(newSettings: AudioviewerConfig) {
    this.viewer.Settings = newSettings;
  }

  constructor() {
    this.subscrmanager = new SubscriptionManager();
  }

  public getLocation(): any {
    const rect = this.loupe.nativeElement.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top
    };
  }

  ngOnChanges(obj: SimpleChanges) {
  }

  ngOnInit() {
    if (!(this.height === null || this.height === undefined)) {
      this.viewer.Settings.multiLine = false;
      this.viewer.Settings.lineheight = this.height;
      this.viewer.Settings.justifySignalHeight = true;
      this.viewer.Settings.boundaries.enabled = true;
      this.viewer.Settings.disabledKeys = [];
      this.viewer.Settings.type = 'line';
    }
  }

  ngAfterViewInit() {
    this.subscrmanager.add(this.viewer.mousecursorchange.subscribe(
      (mousepos) => {
        this.mousecursorchange.emit(mousepos);
      }
    ));
    this.subscrmanager.add(this.viewer.shortcuttriggered.subscribe(
      (str) => {
        this.shortcuttriggered.emit(str);
      }
    ));
    this.subscrmanager.add(this.viewer.segmententer.subscribe(
      (obj) => {
        this.segmententer.emit(obj);
      }
    ));
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  public updateSegments() {
    this.viewer.drawSegments();
  }

  public update(compute = true) {
    this.viewer.name = this._name;
    this.viewer.update(compute);
  }

  onButtonClick(event: { type: string, timestamp: number }) {
    switch (event.type) {
      case('play'):
        this.viewer.startPlayback();
        break;
      case('pause'):
        this.viewer.pausePlayback(() => {
        });
        break;
      case('stop'):
        this.viewer.stopPlayback(() => {
        });
        break;
      case('replay'):
        this.viewer.rePlayback();
        break;
      case('backward'):
        this.viewer.stepBackward(() => {
        });
        break;
      case('backward time'):
        this.viewer.stepBackwardTime(() => {
        }, 0.5);
        break;
      case('default'):
        break;
    }
  }

  public selectSegment(segnumber: number) {
    this.viewer.selectSegment(segnumber);
  }
}
