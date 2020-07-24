import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
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
import {isUnset, SubscriptionManager} from '@octra/utilities';
import {AudioChunk, PlayBackStatus} from '@octra/media';

export interface Buttons {
  play: {
    label: string,
    shortcut: string
  };
  pause: {
    label: string,
    shortcut: string
  };
  stop: {
    label: string,
    shortcut: string
  };
  replay: {
    label: string,
    shortcut: string
  };
  backward: {
    label: string,
    shortcut: string
  };
  backwardtime: {
    label: string,
    shortcut: string
  };
}

@Component({
  selector: 'octra-audio-navigation',
  templateUrl: './audio-navigation.component.html',
  styleUrls: ['./audio-navigation.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AudioNavigationComponent implements AfterViewInit, OnInit, OnChanges, OnDestroy {
  @Output() buttonClick = new EventEmitter<{ type: string, timestamp: number }>();
  @Output() volumeChange = new EventEmitter<{ old_value: number, new_value: number, timestamp: number }>();
  @Output() afterVolumeChange = new EventEmitter<{ new_value: number, timestamp: number }>();
  @Output() playbackRateChange = new EventEmitter<{ old_value: number, new_value: number, timestamp: number }>();
  @Output() afterPlaybackRateChange = new EventEmitter<{ new_value: number, timestamp: number }>();
  @Input() responsive = false;
  @Input() easyMode = false;
  @Input() audioChunk: AudioChunk;
  @Input() stepBackwardTime = 500;

  @Input() buttons: Buttons = {
    play: {
      label: 'Play',
      shortcut: 'TAB'
    },
    pause: {
      label: 'Pause',
      shortcut: 'TAB'
    },
    stop: {
      label: 'Stop',
      shortcut: 'ESC'
    },
    replay: {
      label: 'Replay',
      shortcut: ''
    },
    backward: {
      label: 'Backward',
      shortcut: 'SHIFT + DEL'
    },
    backwardtime: {
      label: 'Backward in time',
      shortcut: 'SHIFT + DEL'
    }
  };

  @ViewChild('audioNavContainer', {static: true}) audioNavContainer: ElementRef;

  private subscrManager = new SubscriptionManager();

  public get height() {
    if (!isUnset(this.audioNavContainer)) {
      return this.audioNavContainer.nativeElement.clientHeight;
    }

    return 0;
  }

  private _replay = false;

  get replay(): boolean {
    return this._replay;
  }

  private _isReady = false;

  get isReady(): boolean {
    return this._isReady;
  }

  private _isAudioPlaying = false;

  get isAudioPlaying(): boolean {
    return this._isAudioPlaying;
  }

  private _volume = 1;

  get volume(): number {
    return this._volume;
  }

  @Input() set volume(value: number) {
    this.volumeChange.emit({
      old_value: Number(this._volume),
      new_value: Number(value),
      timestamp: Date.now()
    });
    this._volume = value;
    if (!isUnset(this.audioChunk)) {
      this.audioChunk.volume = value;
    }
  }

  private _playbackRate = 1;

  get playbackRate(): number {
    return this._playbackRate;
  }

  @Input() set playbackRate(value: number) {
    this.playbackRateChange.emit({
      old_value: Number(this._playbackRate),
      new_value: Number(value),
      timestamp: Date.now()
    });
    this._playbackRate = value;

    if (!isUnset(this.audioChunk)) {
      this.audioChunk.playbackRate = value;
    }
  }

  constructor(private cd: ChangeDetectorRef) {
  }

  ngOnInit(): void {
  }

  ngAfterViewInit() {
  }

  /**
   * this method is called only after a input changed (dirty check)
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!isUnset(changes.audioChunk)) {
      const newAudioChunk: AudioChunk = changes.audioChunk.currentValue;

      if (!isUnset(newAudioChunk)) {
        this.subscrManager.destroy();
        this.connectEvents();
        this.initialize();
        this._isReady = true;
      } else {
        // not ready
        this._isReady = false;
      }
      this.cd.markForCheck();
      this.cd.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.subscrManager.destroy();
  }

  /**
   * called when button of navigation has been clicked
   * @param type "play", "pause", "stop", "replay" or "backward"
   */
  onButtonClick(type: string) {
    switch (type) {
      case('play'):
        this.onPlayButtonClicked();
        break;
      case('pause'):
        this.onPauseButtonClicked();
        break;
      case('stop'):
        this.onStopButtonClicked();
        break;
      case('replay'):
        this.onReplayButtonClicked();
        break;
      case('backward'):
        this.onBackwardButtonClicked();
        break;
      case('backward time'):
        this.onBackwardTimeButtonClicked();
        break;
      case('default'):
        console.error('button not found');
        break;
    }
    this.cd.detectChanges();
  }

  /***
   * after value of volume was changed
   */
  afterVolumeChanged() {
    this.afterVolumeChange.emit({
      new_value: this.volume,
      timestamp: Date.now()
    });
  }

  /***
   * after value of playbackRate was changed
   */
  afterPlaybackRateChanged() {
    this.afterPlaybackRateChange.emit({
      new_value: this.playbackRate,
      timestamp: Date.now()
    });
  }

  private initialize() {
    this.audioChunk.playbackRate = this._playbackRate;
    this.audioChunk.volume = this._volume;
  }

  private connectEvents() {
    this.subscrManager.add(this.audioChunk.statuschange.subscribe((status: PlayBackStatus) => {
        this._isAudioPlaying = status === PlayBackStatus.PLAYING;
        this.cd.markForCheck();
        this.cd.detectChanges();
      },
      (error) => {
        console.error(error);
      },
      () => {

      }));
  }

  private onPlayButtonClicked() {
    this.triggerButtonClick('play');
    this.audioChunk.startPlayback(false).catch((error) => {
      console.error(error);
    });
  }

  private onPauseButtonClicked() {
    this.triggerButtonClick('pause');
    this.audioChunk.pausePlayback().catch((error) => {
      console.error(error);
    });
  }

  private onStopButtonClicked() {
    this.triggerButtonClick('stop');
    this.audioChunk.stopPlayback().catch((error) => {
      console.error(error);
    });
  }

  private onReplayButtonClicked() {
    this.audioChunk.toggleReplay();
    this.triggerButtonClick('replay');
    this._replay = this.audioChunk.replay;
  }

  private onBackwardButtonClicked() {
    this.triggerButtonClick('backward');
    this.audioChunk.stepBackward().catch((error) => {
      console.error(error);
    });
  }

  private onBackwardTimeButtonClicked() {
    this.triggerButtonClick('backward time');
    this.audioChunk.stepBackwardTime(500 / 1000).catch((error) => {
      console.error(error);
    });
  }

  private triggerButtonClick(type: string) {
    this.buttonClick.emit({type, timestamp: Date.now()});
  }
}
