import {Component, Input, OnInit, ViewChild} from '@angular/core';
import {AlertService, AppStorageService, SettingsService, TranscriptionService} from '../../shared/service';
import {AppSettings, ASRLanguage} from '../../obj/Settings';
import {AsrService} from '../../shared/service/asr.service';
import {isUnset} from '../../shared/Functions';
import {BsDropdownDirective} from 'ngx-bootstrap';
import {TranslocoService} from '@ngneat/transloco';
import {AudioChunk} from '../../../media-components/obj/audio/AudioManager';
import {ASRQueueItemType} from '../../../media-components/obj/annotation/asr';
import {AppInfo} from '../../../app.info';

@Component({
  selector: 'app-asr-options',
  templateUrl: './asr-options.component.html',
  styleUrls: ['./asr-options.component.css']
})
export class AsrOptionsComponent implements OnInit {

  public get appSettings(): AppSettings {
    return this.settingsService.appSettings;
  }

  public serviceProviders = {};
  public settings = {
    onlyForThisOne: false,
    allSegmentsNext: false
  };

  @Input() audioChunk: AudioChunk;
  @Input() enabled = true;
  @ViewChild('dropdown', {static: true}) dropdown: BsDropdownDirective;

  constructor(public appStorage: AppStorageService, public settingsService: SettingsService,
              public asrService: AsrService, private transcrService: TranscriptionService,
              private alertService: AlertService, private langService: TranslocoService) {
    for (let i = 0; i < this.appSettings.octra.plugins.asr.services.length; i++) {
      const provider = this.appSettings.octra.plugins.asr.services[i];
      this.serviceProviders['' + provider.provider] = provider;
    }
  }

  public get manualURL(): string {
    return AppInfo.manualURL;
  }

  ngOnInit() {

  }

  onMouseMove() {

  }

  onMouseOut() {

  }

  getShortCode(code) {
    return code.substring(code.length - 2);
  }

  onASRLangChanged(lang: ASRLanguage) {
    this.asrService.selectedLanguage = lang;
    this.dropdown.hide();
  }

  startASRForThisSegment() {
    if (!isUnset(this.asrService.selectedLanguage)) {
      if (this.audioChunk.time.duration.seconds > 600) {
        // trigger alert, too big audio duration
        this.alertService.showAlert('danger', this.langService.translate('asr.file too big').toString());
      } else {
        const time = this.audioChunk.time.start.add(this.audioChunk.time.duration);
        const segNumber = this.transcrService.currentlevel.segments.getSegmentBySamplePosition(time);

        if (segNumber > -1) {
          console.log(`SEGNUMBER = ${segNumber} browser sample is ${time.samples}`);
          const segment = this.transcrService.currentlevel.segments.get(segNumber);

          if(!isUnset(segment)) {
            segment.isBlockedBy = ASRQueueItemType.ASR;

            this.asrService.addToQueue({
              sampleStart: this.audioChunk.time.start.samples,
              sampleLength: this.audioChunk.time.duration.samples,
              browserSampleEnd: this.audioChunk.time.start.add(this.audioChunk.time.duration).samples
            }, ASRQueueItemType.ASR);
            this.asrService.startASR();
          } else {
            console.error(`could not find segment for doing ASR.`);
          }
        } else {
          console.error(`could not start ASR because segment number was not found.`);
        }
      }
    }
  }

  startASRForAllSegmentsNext() {
    const segNumber = this.transcrService.currentlevel.segments.getSegmentBySamplePosition(
      this.audioChunk.time.start.add(this.audioChunk.time.duration)
    );

    if (segNumber > -1) {
      for (let i = segNumber; i < this.transcrService.currentlevel.segments.length; i++) {
        const segment = this.transcrService.currentlevel.segments.get(i);

        if(!isUnset(segment)){
          const sampleStart = (i > 0) ? this.transcrService.currentlevel.segments.get(i - 1).time.originalSample.value
            : 0;
          const sampleLength = segment.time.originalSample.value - sampleStart;

          if (sampleLength / this.transcrService.audiomanager.originalSampleRate > 600) {
            this.alertService.showAlert('danger', this.langService.translate('asr.file too big'));
            segment.isBlockedBy = null;
          } else {
            if (segment.transcript.trim() === '' && segment.transcript.indexOf(this.transcrService.breakMarker.code) < 0) {
              // segment is empty and contains not a break
              segment.isBlockedBy = ASRQueueItemType.ASR;
              this.asrService.addToQueue({
                sampleStart, sampleLength, browserSampleEnd:
                segment.time.browserSample.value
              }, ASRQueueItemType.ASR);
            }
          }
        } else {
          console.error(`could not find segment in startASRForAllSegmentsNext()`);
        }
      }
      this.asrService.startASR();
    } else {
      console.error(`could not start ASR for all next because segment number was not found.`);
    }
  }

  stopASRForAll() {
    this.asrService.stopASR();
    this.asrService.queue.clear();
  }

  stopASRForThisSegment() {
    if (!isUnset(this.asrService.selectedLanguage)) {
      const item = this.asrService.queue.getItemByTime(this.audioChunk.time.start.samples, this.audioChunk.time.duration.samples);

      if (item !== undefined) {
        this.asrService.stopASROfItem(item);
      }
    } else {
      console.error(`could not stop ASR because segment number was not found.`);
    }
  }
}
