import {EventEmitter, Injectable} from '@angular/core';
import 'rxjs/Observable';
import {Segments} from '../shared/Segments';
import {AudioService} from './audio.service';
import {SessionService} from './session.service';
import {Functions} from '../shared/Functions';
import {UserInteractionsService} from './userInteractions.service';
import {StatisticElem} from '../shared/StatisticElement';
import {MouseStatisticElem} from '../shared/MouseStatisticElem';
import {KeyStatisticElem} from '../shared/KeyStatisticElem';
import {NavbarService} from './navbar.service';
import {SubscriptionManager} from '../shared';
import {SettingsService} from './settings.service';
import {isNullOrUndefined} from 'util';
import {Http} from '@angular/http';
import {FeedBackForm} from '../shared/FeedbackForm/FeedBackForm';
import {IAudioFile, OAnnotJSON, OAudiofile, OLabel, OLevel, OSegment} from '../types/annotjson';
import {Annotation} from '../shared/Annotation/Annotation';
import {Converter, File} from '../shared/Converters/Converter';
import {TextConverter} from '../shared/Converters/TextConverter';
import {AnnotJSONConverter} from '../shared/Converters/AnnotJSONConverter';
import {Level} from '../shared/Annotation/Level';

@Injectable()
export class TranscriptionService {
  get annotation(): Annotation {
    return this._annotation;
  }

  set annotation(value: Annotation) {
    this._annotation = value;
  }

  private subscrmanager: SubscriptionManager;

  public dataloaded = new EventEmitter<any>();
  public segmentrequested = new EventEmitter<number>();

  private _segments: Segments;
  private _last_sample: number;
  private _guidelines: any;

  private saving = false;

  public filename = '';

  private _feedback: FeedBackForm;

  private _break_marker: any = null;

  private _selectedSegment: any = null;
  private state = 'ANNOTATED';

  private _statistic: any = {
    transcribed: 0,
    empty: 0,
    pause: 0
  };

  private _annotation: Annotation;

  get feedback(): FeedBackForm {
    return this._feedback;
  }

  set break_marker(value: any) {
    this._break_marker = value;
  }

  set guidelines(value: any) {
    this._guidelines = value;
  }

  get guidelines(): any {
    return this._guidelines;
  }

  get last_sample(): number {
    return this._last_sample;
  }

  set last_sample(value: number) {
    this._last_sample = value;
  }

  /*
   get segments(): Segments {

   return this._segments;
   }
   */

  public validate(text: string): any {
    return validateAnnotation(text, this._guidelines);
  }

  /*
   set segments(value: Segments) {
   this._segments = value;
   }
   */

  private get app_settings(): any {
    return this.settingsService.app_settings;
  }

  private get projectsettings(): any {
    return this.settingsService.projectsettings;
  }

  get break_marker(): any {
    return this._break_marker;
  }

  get statistic(): any {
    return this._statistic;
  }

  get selectedSegment(): any {
    return this._selectedSegment;
  }

  set selectedSegment(value: any) {
    this._selectedSegment = value;
  }

  constructor(private audio: AudioService,
              private sessServ: SessionService,
              private uiService: UserInteractionsService,
              private navbarServ: NavbarService,
              private settingsService: SettingsService,
              private http: Http) {
    this.subscrmanager = new SubscriptionManager();

    this.subscrmanager.add(this.navbarServ.onexportbuttonclick.subscribe((button) => {
      const result = {};

      if (button.format === 'text') {
        // format to text file
        this.navbarServ.exportformats.text = this.getTranscriptString(new TextConverter());
      } else if (button.format === 'annotJSON') {
        // format to annotJSON file
        this.navbarServ.exportformats.annotJSON = this.getTranscriptString(new AnnotJSONConverter());
      }
    }));
  }

  /**
   * metod after audio was loaded
   */
  public load() {

    if (this.sessServ.offline) {
      this.filename = this.sessServ.file.name;
      if (this.filename.indexOf('.wav') > -1) {
        this.filename = this.filename.substr(0, this.filename.indexOf('.wav'));
      }
    } else {
      const start = this.sessServ.audio_url.search(/(%|-|\.|[A-ZÄÖÜß]|[a-zäöü]|_|[0-9])*.wav/g);
      if (start > -1) {
        this.filename = this.sessServ.audio_url.substr(start, this.sessServ.audio_url.indexOf('.wav') - start);
      } else {
        this.filename = this.sessServ.audio_url;
      }
    }
    this.last_sample = this.audio.duration.samples;
    this.loadSegments(this.audio.samplerate);

    this.navbarServ.exportformats.filename = this.filename;
    this.navbarServ.exportformats.bitrate = this.audio.bitrate;
    this.navbarServ.exportformats.samplerate = this.audio.samplerate;
    this.navbarServ.exportformats.filesize = Functions.getFileSize(this.audio.size);
    this.navbarServ.exportformats.duration = this.audio.duration.unix;
  }

  public getTranscriptString(converter: Converter): string {
    let result: File;

    if (!isNullOrUndefined(this.annotation)) {
      const data = this.annotation;

      result = converter.export(this.annotation.getObj());

      return result.content;
    }

    return '';
  }

  public loadSegments(sample_rate: number) {
    if (isNullOrUndefined(this.sessServ.annotation)) {
      this.sessServ.annotation = this.createNewAnnotation();

      if (!this.sessServ.offline) {
        if (!isNullOrUndefined(this.sessServ.servertranscipt)) {
          // import server transcript
          this.sessServ.annotation.levels[0].items = [];
          for (let i = 0; i < this.sessServ.servertranscipt.length; i++) {
            const seg_t = this.sessServ.servertranscipt[i];

            const oseg = new OSegment(i, seg_t.start, seg_t.length, [new OLabel('Orthographic', seg_t.text)]);
            this.sessServ.annotation.levels[0].items.push(oseg);
          }
          // clear servertranscript
          this.sessServ.servertranscipt = null;
        }
      }
    }

    this.sessServ.annotation.annotates = this.filename + '.wav';

    this.sessServ.annotation.sampleRate = this.audio.samplerate;
    const audiofile: OAudiofile = new OAudiofile();
    audiofile.samplerate = this.audio.samplerate;
    audiofile.name = this.sessServ.annotation.annotates;
    this._annotation = new Annotation(this.sessServ.annotation.annotates, audiofile);

    for (let i = 0; i < this.sessServ.annotation.levels.length; i++) {
      const level: Level = Level.fromObj(this.sessServ.annotation.levels[i],
        this.audio.samplerate, this.audio.duration.samples);
      this._annotation.levels.push(level);
    }

    // load feedback form data
    if (isNullOrUndefined(this.sessServ.feedback)) {
      this.sessServ.feedback = {};
    }

    this._feedback = FeedBackForm.fromAny(this.settingsService.projectsettings.feedback_form, this.sessServ.comment);
    this._feedback.importData(this.sessServ.feedback);

    if (isNullOrUndefined(this.sessServ.comment)) {
      this.sessServ.comment = '';
    } else {
      this._feedback.comment = this.sessServ.comment;
    }

    if (this.sessServ.logs === null) {
      this.sessServ.logs = [];
      this.uiService.elements = [];
    } else {
      this.uiService.fromAnyArray(this.sessServ.logs);
    }

    this.navbarServ.dataloaded = true;
    this.dataloaded.emit();
  }

  public exportDataToJSON(): any {
    let data: any = {};

    if (!isNullOrUndefined(this.annotation)) {
      const log_data: any[] = this.extractUI(this.uiService.elements);

      data = {
        project: (isNullOrUndefined(this.sessServ.member_project)) ? 'NOT AVAILABLE' : this.sessServ.member_project,
        annotator: (isNullOrUndefined(this.sessServ.member_id)) ? 'NOT AVAILABLE' : this.sessServ.member_id,
        transcript: null,
        comment: this._feedback.comment,
        jobno: (isNullOrUndefined(this.sessServ.member_jobno)) ? 'NOT AVAILABLE' : this.sessServ.member_jobno,
        status: this.state,
        quality: this._feedback.exportData(),
        id: this.sessServ.data_id,
        log: log_data
      };

      const transcript: any[] = [];

      for (let i = 0; i < this.annotation.levels[0].segments.length; i++) {
        const segment = this.annotation.levels[0].segments.get(i);

        let last_bound = 0;
        if (i > 0) {
          last_bound = this.annotation.levels[0].segments.get(i - 1).time.samples;
        }

        const segment_json: any = {
          start: last_bound,
          length: segment.time.samples - last_bound,
          text: segment.transcript
        };

        transcript.push(segment_json);
      }

      data.transcript = transcript;
    }

    return data;
  }

  public saveSegments = () => {
    // make sure, that no saving overhead exist. After saving request wait 1 second
    if (!this.saving) {
      this.saving = true;
      setTimeout(() => {
        this.sessServ.save('annotation', this._annotation.getObj());
        this.saving = false;
      }, 2000);
    }
  }

  public destroy() {
    this.subscrmanager.destroy();

    // set data to null
    this._segments = null;
    this._last_sample = null;
    this._guidelines = null;
    this.saving = false;
    this.filename = '';

    this._feedback = null;

    this._break_marker = null;

    this._selectedSegment = null;
    this.state = 'ANNOTATED';

    this._statistic = {
      transcribed: 0,
      empty: 0,
      pause: 0
    };

    this.uiService.elements = [];
  }

  private extractUI(ui_elements: StatisticElem[]): any[] {
    const result: any[] = [];

    if (ui_elements) {
      for (let i = 0; i < ui_elements.length; i++) {
        const elem = ui_elements[i];

        const new_elem = {
          timestamp: elem.timestamp,
          message: '', // not implemented
          type: elem.type,
          targetname: elem.target_name,
          value: ''
        };

        if (elem instanceof MouseStatisticElem) {
          new_elem.value = elem.value;
        } else if (elem instanceof KeyStatisticElem) {
          new_elem.value = elem.char;
        } else {
          new_elem.value = elem.value;
        }

        if (new_elem.value == null) {
          new_elem.value = 'no obj';
        }

        result.push(new_elem);
      }
    }

    return result;
  }

  public analyse() {
    this._statistic = {
      transcribed: 0,
      empty: 0,
      pause: 0
    };

    for (let i = 0; i < this._annotation.levels[0].segments.length; i++) {
      const segment = this._annotation.levels[0].segments.get(i);

      if (segment.transcript !== '') {
        if (this.break_marker != null && segment.transcript.indexOf(this.break_marker.code) > -1) {
          this._statistic.pause++;
        } else {
          this._statistic.transcribed++;
        }
      } else {
        this._statistic.empty++;
      }
    }
  }

  /**
   * converts raw text of markers to html
   * @param rawtext
   * @returns {string}
   */
  public rawToHTML(rawtext: string): string {
    let result: string = rawtext;

    result = this.replaceMarkersWithHTML(result);

    if (rawtext !== '') {
      result = result.replace(/\s+$/g, '&nbsp;');
      result = (result !== '') ? '' + result + '' : '';
    }

    return result;
  }

  /**
   * replace markers of the input string with its html pojection
   * @param input
   * @param use_wrap
   * @returns {string}
   */
  private replaceMarkersWithHTML(input: string): string {
    let result = input;
    for (let i = 0; i < this._guidelines.markers.length; i++) {
      const marker = this._guidelines.markers[i];
      const regex = new RegExp(Functions.escapeRegex(marker.code), 'g');
      result = result.replace(regex, '<img src=\'' + marker.icon_url + '\' class=\'btn-icon-text\' ' +
        'style=\'height:16px;\' data-marker-code=\'' + marker.code + '\'/>');
    }
    return result;
  }

  public underlineTextRed(rawtext: string, validation: any[]) {
    let result = rawtext;

    interface Pos {
      start: number;
      puffer: string;
    }

    let insertions: Pos[] = [];

    if (validation.length > 0) {
      // prepare insertions
      for (let i = 0; i < validation.length; i++) {
        const insertStart = insertions.find((val) => {
          return val.start === validation[i].start;
        });
        const insertEnd = insertions.find((val) => {
          return val.start === validation[i].start;
        });

        if (isNullOrUndefined(insertStart)) {
          insertions.push({
            start: validation[i].start,
            puffer: '<div class=\'error_underline\' data-errorcode=\'' + validation[i].code + '\'>'
          });
        } else {
          insertStart.puffer += '<div class=\'error_underline\' data-errorcode=\'' + validation[i].code + '\'>';
        }

        if (isNullOrUndefined(insertEnd)) {
          insertions.push({
            start: validation[i].start + validation[i].length,
            puffer: '</div>'
          });
        } else {
          insertEnd.puffer = '</div>' + insertEnd.puffer;
        }
      }

      insertions = insertions.sort(function (a, b) {
        if (a.start === b.start) {
          return 0;
        }
        if (a.start < b.start) {
          return -1;
        }
        if (a.start > b.start) {
          return 1;
        }
      });

      let puffer = '';
      for (let key = 0; key < insertions.length; key++) {
        const offset = puffer.length;
        const pos = insertions[key].start;

        result = Functions.insertString(result, pos + offset, insertions[key].puffer);
        puffer += insertions[key].puffer;
      }
    }
    return result;

  }

  public getErrorDetails(code: string): any {
    if (!isNullOrUndefined(this._guidelines.instructions)) {
      const instructions = this._guidelines.instructions;

      for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];

        for (let j = 0; j < instruction.entries.length; j++) {
          const entry = instruction.entries[j];

          if (entry.code === code) {
            return entry;
          }
        }
      }
    }
    return null;
  }

  public requestSegment(segnumber: number) {
    if (segnumber < this._annotation.levels[0].segments.length) {
      this.segmentrequested.emit(segnumber);
    } else {
    }
  }

  /**
   * resets the parent object values. Call this function after transcription was saved
   */
  public endTranscription = (destroyaudio: boolean = true) => {
    this.audio.destroy(destroyaudio);
    this.destroy();
  }


  public createNewAnnotation(): OAnnotJSON {
    let filesize = 0;

    if (!isNullOrUndefined(this.sessServ.sessionfile)) {
      filesize = this.sessServ.sessionfile.size;
    } else {
      filesize = this.audio.size;
    }
    const audiofile: IAudioFile = {
      name: this.filename,
      size: filesize,
      duration: this.audio.duration.seconds,
      samplerate: this.audio.samplerate
    };

    const level: OLevel = new OLevel('orthographic', 'SEGMENT', []);
    level.items.push(new OSegment(1, 0, this.audio.duration.samples, [(new OLabel('Orthographic', ''))]));
    const levels: OLevel[] = [];
    levels.push(level);

    return new OAnnotJSON(this.filename, this.audio.samplerate, levels);
  }
}
