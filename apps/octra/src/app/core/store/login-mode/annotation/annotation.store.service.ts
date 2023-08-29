import { EventEmitter, Injectable } from '@angular/core';
import { getModeState, LoginMode, RootState } from '../../index';
import { Store } from '@ngrx/store';
import { AnnotationActions } from './annotation.actions';
import { LoginModeActions } from '../login-mode.actions';
import {
  escapeRegex,
  getTranscriptFromIO,
  insertString,
  SubscriptionManager,
} from '@octra/utilities';
import {
  AnnotationLevelType,
  ASRContext,
  OAnnotJSON,
  OctraAnnotation,
  OctraAnnotationAnyLevel,
  OctraAnnotationSegmentLevel,
  OEvent,
  OItem,
  Segment,
  TextConverter,
} from '@octra/annotation';
import { AudioService } from '../../../shared/service';
import { AppStorageService } from '../../../shared/service/appstorage.service';
import { StatisticElem } from '../../../obj/statistics/StatisticElement';
import { OLog, OLogging } from '../../../obj/Settings/logging';
import { MouseStatisticElem } from '../../../obj/statistics/MouseStatisticElem';
import { KeyStatisticElem } from '../../../obj/statistics/KeyStatisticElem';
import { map, Observable } from 'rxjs';
import { ProjectSettings } from '../../../obj';
import { OctraGuidelines } from '@octra/assets';
import { ApplicationStoreService } from '../../application/application-store.service';

declare let validateAnnotation: (transcript: string, guidelines: any) => any;
declare let tidyUpAnnotation: (transcript: string, guidelines: any) => any;

@Injectable({
  providedIn: 'root',
})
export class AnnotationStoreService {
  public segmentrequested = new EventEmitter<number>();

  get feedback(): any {
    return this._feedback;
  }

  get transcript(): OctraAnnotation<ASRContext, Segment> | undefined {
    return this._transcript;
  }

  public get statistics$(): Observable<{
    transcribed: number;
    empty: number;
    pause: number;
  }> {
    return this.currentLevel$.pipe(
      map((level) => {
        const result = {
          transcribed: 0,
          empty: 0,
          pause: 0,
        };

        if (level instanceof OctraAnnotationSegmentLevel) {
          for (let i = 0; i < level.items.length; i++) {
            const item = level.items[i];
            const labelIndex = item.labels.findIndex(
              (a) => a.name !== 'Speaker'
            );

            if (labelIndex > -1 && item.labels[labelIndex].value !== '') {
              if (
                this.breakMarker !== undefined &&
                item.labels[labelIndex].value.indexOf(this.breakMarker.code) >
                  -1
              ) {
                result.pause++;
              } else {
                result.transcribed++;
              }
            } else {
              result.empty++;
            }
          }
        }
        return result;
      })
    );
  }

  private _statistics = {
    transcribed: 0,
    empty: 0,
    pause: 0,
  };

  get statistics(): { transcribed: number; pause: number; empty: number } {
    return this._statistics;
  }

  get breakMarker() {
    return this.guidelines?.markers.find((a) => a.type === 'break');
  }

  private _validationArray: {
    segment: number;
    validation: any[];
  }[] = [];
  private subscrManager = new SubscriptionManager();

  get validationArray(): { segment: number; validation: any[] }[] {
    return this._validationArray;
  }

  private _transcriptValid = false;
  get transcriptValid(): boolean {
    return this._transcriptValid;
  }

  task$ = this.store.select(
    (state: RootState) => getModeState(state)?.currentSession?.task
  );

  textInput$ = this.store.select((state: RootState) => {
    if (
      state.application.mode === undefined ||
      state.application.mode === LoginMode.LOCAL ||
      state.application.mode === LoginMode.URL
    ) {
      return undefined;
    }

    const mode = getModeState(state);
    const result = getTranscriptFromIO(
      mode?.currentSession?.task?.inputs ?? []
    );
    return result;
  });

  currentLevel$ = this.store.select((state: RootState) => {
    const transcriptState = getModeState(state)?.transcript;
    if (transcriptState) {
      return transcriptState.currentLevel;
    }
    return undefined;
  });
  private _currentLevel?: OctraAnnotationAnyLevel<Segment>;

  get currentLevel(): OctraAnnotationAnyLevel<Segment> | undefined {
    return this._currentLevel;
  }

  currentLevelIndex$ = this.store.select((state: RootState) => {
    const transcriptState = getModeState(state)?.transcript;
    if (transcriptState) {
      return transcriptState.selectedLevelIndex ?? 0;
    }
    return 0;
  });
  private _currentLevelIndex = 0;

  get currentLevelIndex(): number {
    return this._currentLevelIndex;
  }

  transcript$ = this.store.select(
    (state: RootState) => getModeState(state)?.transcript
  );
  private _transcript?: OctraAnnotation<ASRContext, Segment>;

  transcriptString$ = this.transcript$.pipe(
    map((transcript) => {
      if (transcript) {
        const result = new TextConverter().export(
          new OAnnotJSON(
            this.audio.audioManager.resource.name,
            this.audio.audioManager.resource.name.replace(/\.[^.]+$/g, ''),
            this.audio.audiomanagers[0].resource.info.sampleRate,
            transcript.levels.map((a) => a.serialize())
          ),
          this.audio.audioManager.resource.getOAudioFile(),
          transcript.selectedLevelIndex!
        )!.file!;

        return result.content;
      }
      return '';
    })
  );

  guidelines$ = this.store.select(
    (state: RootState) => getModeState(state)?.guidelines
  );
  private _guidelines?: OctraGuidelines;

  get guidelines(): OctraGuidelines | undefined {
    return this._guidelines;
  }

  feedback$ = this.store.select(
    (state: RootState) => getModeState(state)?.currentSession.assessment
  );
  private _feedback: any; // TODO check feedback

  breakMarker$ = this.store.select((state: RootState) =>
    getModeState(state)?.guidelines?.selected?.json?.markers?.find(
      (a) => a.type === 'break'
    )
  );

  public set comment(value: string | undefined) {
    this.changeComment(value ?? '');
  }

  public get comment(): string {
    return getModeState(this.appStorage.snapshot)?.currentSession.comment ?? '';
  }

  constructor(
    private store: Store<RootState>,
    private audio: AudioService,
    private appStoreService: ApplicationStoreService,
    private appStorage: AppStorageService
  ) {
    this.subscrManager.add(
      this.transcript$.subscribe({
        next: (transcript) => {
          this._transcript = transcript;
        },
      })
    );
    this.subscrManager.add(
      this.guidelines$.subscribe({
        next: (guidelines) => {
          this._guidelines = guidelines?.selected?.json;
        },
      })
    );
    this.subscrManager.add(
      this.currentLevel$.subscribe({
        next: (currentLevel) => {
          this._currentLevel = currentLevel;
        },
      })
    );
    this.subscrManager.add(
      this.currentLevelIndex$.subscribe({
        next: (currentLevel) => {
          this._currentLevelIndex = currentLevel;
        },
      })
    );
    this.subscrManager.add(
      this.feedback$.subscribe({
        next: (value) => {
          this._feedback = value;
        },
      })
    );
    this.subscrManager.add(
      this.statistics$.subscribe({
        next: (value) => {
          this._statistics = value;
        },
      })
    );
  }

  setLogs(value: any[], mode: LoginMode) {
    this.store.dispatch(
      AnnotationActions.saveLogs.do({
        logs: value ?? [],
        mode,
      })
    );
  }

  quit(clearSession: boolean, freeTask: boolean, redirectToProjects = false) {
    this.store.dispatch(
      AnnotationActions.quit.do({
        clearSession,
        freeTask,
        redirectToProjects,
      })
    );
  }

  sendAnnotation() {
    this.store.dispatch(AnnotationActions.sendAnnotation.do());
  }

  changeComment(comment: string) {
    this.store.dispatch(
      LoginModeActions.changeComment.do({
        mode: LoginMode.ONLINE,
        comment,
      })
    );
  }

  changeLevelName(index: number, name: string) {
    this.store.dispatch(
      AnnotationActions.changeLevelName.do({
        index,
        name,
      })
    );
  }

  resumeTaskManually() {
    this.store.dispatch(AnnotationActions.resumeTaskManually.do());
  }

  public addAnnotationLevel(levelType: AnnotationLevelType) {
    this.store.dispatch(
      AnnotationActions.addAnnotationLevel.do({
        levelType,
        audioDuration: this.audio.audiomanagers[0].resource.info.duration,
        mode: this.appStorage.useMode,
      })
    );
  }

  public duplicateLevel(index: number) {
    this.store.dispatch(
      AnnotationActions.duplicateLevel.do({
        index,
        mode: this.appStorage.useMode,
      })
    );
  }

  removeLevel(id: number) {
    this.store.dispatch(
      AnnotationActions.removeAnnotationLevel.do({
        id,
        mode: this.appStorage.useMode,
      })
    );
  }

  /***
   * destroys audio service and transcr service. Call this after quit.
   * @param destroyaudio
   */
  public endTranscription = (destroyaudio: boolean = true) => {
    this.audio.destroy(destroyaudio);
  };

  public destroy() {
    this.subscrManager.destroy();
  }

  public validate(rawText: string): any[] {
    const results = validateAnnotation(rawText, this.guidelines);

    // check if selection is in the raw text
    const sPos = rawText.indexOf('[[[sel-start/]]]');
    const sLen = '[[[sel-start/]]]'.length;
    const ePos = rawText.indexOf('[[[sel-end/]]]');
    const eLen = '[[[sel-end/]]]'.length;

    // look for segment boundaries like {23423424}
    const segRegex = new RegExp(/{[0-9]+}/g);

    for (let i = 0; i < results.length; i++) {
      const validation = results[i];

      if (sPos > -1 && ePos > -1) {
        // check if error is between the selection marks
        if (
          (validation.start >= sPos &&
            validation.start + validation.length <= sPos + sLen) ||
          (validation.start >= ePos &&
            validation.start + validation.length <= ePos + eLen)
        ) {
          // remove
          results.splice(i, 1);
          i--;
        }
      }

      let match = segRegex.exec(rawText);
      while (match != undefined) {
        if (
          validation.start >= match.index &&
          validation.start + validation.length <= match.index + match[0].length
        ) {
          // remove
          results.splice(i, 1);
          i--;
        }

        match = segRegex.exec(rawText);
      }
    }

    return results;
  }

  public replaceSingleTags(html: string) {
    html = html.replace(/(<)([^<>]+)(>)/g, (g0, g1, g2) => {
      return `[[[${g2}]]]`;
    });

    html = html.replace(/([<>])/g, (g0, g1) => {
      if (g1 === '<') {
        return '&lt;';
      }
      return '&gt;';
    });

    html = html.replace(/((?:\[\[\[)|(?:]]]))/g, (g0, g1) => {
      if (g1 === '[[[') {
        return '<';
      }

      return '>';
    });

    return html;
  }

  public extractUI(uiElements: StatisticElem[]): OLogging {
    const now = new Date();
    const result: OLogging = new OLogging(
      '1.0',
      'UTF-8',
      this.appStorage.onlineSession?.currentProject?.name === undefined
        ? 'local'
        : this.appStorage.onlineSession?.currentProject?.name,
      now.toUTCString(),
      this.audio.audioManager.resource.name,
      this.audio.audioManager.resource.info.sampleRate,
      this.audio.audioManager.resource.info.duration.samples,
      []
    );

    if (uiElements) {
      for (const elem of uiElements) {
        const newElem = new OLog(
          elem.timestamp,
          elem.type,
          elem.context,
          '',
          elem.playpos,
          elem.caretpos,
          elem.selection,
          elem.segment
        );

        if (elem instanceof MouseStatisticElem) {
          newElem.value = elem.value;
        } else if (elem instanceof KeyStatisticElem) {
          newElem.value = (elem as KeyStatisticElem).value;
        } else {
          newElem.value = (elem as StatisticElem).value;
        }

        result.logs.push(newElem);
      }
    }

    return result;
  }

  /**
   * converts raw text of markers to html
   */
  public rawToHTML(rawtext: string): string {
    let result: string = rawtext;

    if (rawtext !== '') {
      result = result.replace(/\r?\n/g, ' '); // .replace(/</g, "&lt;").replace(/>/g, "&gt;");
      // replace markers with no wrap

      const markers = this.guidelines!.markers;
      // replace all tags that are not markers
      result = result.replace(
        new RegExp(/(<\/?)?([^<>]+)(>)/, 'g'),
        (g0, g1, g2, g3) => {
          g1 = g1 === undefined ? '' : g1;
          g2 = g2 === undefined ? '' : g2;
          g3 = g3 === undefined ? '' : g3;

          // check if its an html tag
          if (
            g2 === 'img' &&
            g2 === 'span' &&
            g2 === 'div' &&
            g2 === 'i' &&
            g2 === 'b' &&
            g2 === 'u' &&
            g2 === 's'
          ) {
            return `[[[${g2}]]]`;
          }

          // check if it's a marker
          for (const marker of markers) {
            if (`${g1}${g2}${g3}` === marker.code) {
              return `[[[${g2}]]]`;
            }
          }

          return `${g1}${g2}${g3}`;
        }
      );

      // replace
      result = result.replace(/([<>])/g, (g0, g1) => {
        if (g1 === '<') {
          return '&lt;';
        }

        return '&gt;';
      });

      result = result.replace(/(\[\[\[)|(]]])/g, (g0, g1, g2) => {
        if (g2 === undefined && g1 !== undefined) {
          return '<';
        } else {
          return '>';
        }
      });

      for (const marker of markers) {
        // replace {<number>} with boundary HTMLElement
        result = result.replace(/\s?{([0-9]+)}\s?/g, (x, g1) => {
          return (
            ' <img src="assets/img/components/transcr-editor/boundary.png" ' +
            'class="btn-icon-text boundary" style="height:16px;" ' +
            'data-samples="' +
            g1 +
            '" alt="[|' +
            g1 +
            '|]"> '
          );
        });

        // replace markers
        const regex = new RegExp(
          '( )*(' + escapeRegex(marker.code) + ')( )*',
          'g'
        );
        result = result.replace(regex, (x, g1, g2, g3) => {
          const s1 = g1 ? g1 : '';
          const s3 = g3 ? g3 : '';

          let img = '';
          if (
            !(marker.icon === undefined || marker.icon === '') &&
            (marker.icon.indexOf('.png') > -1 ||
              marker.icon.indexOf('.jpg') > -1 ||
              marker.icon.indexOf('.gif') > -1)
          ) {
            const markerCode = marker.code
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');

            img =
              "<img src='" +
              marker.icon +
              "' class='btn-icon-text boundary' style='height:16px;' " +
              "data-marker-code='" +
              markerCode +
              "' alt='" +
              markerCode +
              "'/>";
          } else {
            // is text or ut8 symbol
            if (marker.icon !== undefined && marker.icon !== '') {
              img = marker.icon;
            } else {
              img = marker.code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
          }

          return s1 + img + s3;
        });
      }

      // replace more than one empty spaces
      result = result.replace(/\s+$/g, '&nbsp;');
    }

    // wrap result with <p>. Missing this would cause the editor fail on marker insertion
    result = result !== '' && result !== ' ' ? '<p>' + result + '</p>' : '';

    return result.replace(/\uFEFF/gm, '');
  }

  public underlineTextRed(rawtext: string, validation: any[]) {
    let result = rawtext;

    interface Pos {
      start: number;
      puffer: string;
    }

    const markerPositions = this.getMarkerPositions(rawtext, this.guidelines);

    let insertions: Pos[] = [];

    if (validation.length > 0) {
      // prepare insertions
      for (const validationElement of validation) {
        const foundMarker = markerPositions.find((a) => {
          return (
            validationElement.start > a.start &&
            validationElement.start + validationElement.length < a.end
          );
        });

        if (foundMarker === undefined) {
          let insertStart = insertions.find((val) => {
            return val.start === validationElement.start;
          });

          if (insertStart === undefined) {
            insertStart = {
              start: validationElement.start,
              puffer:
                "[[[span class='val-error' data-errorcode='" +
                validationElement.code +
                "']]]",
            };
            insertions.push(insertStart);
          } else {
            insertStart.puffer +=
              "[[[span class='val-error' data-errorcode='" +
              validationElement.code +
              "']]]";
          }

          let insertEnd = insertions.find((val) => {
            return (
              val.start === validationElement.start + validationElement.length
            );
          });

          if (insertEnd === undefined) {
            insertEnd = {
              start: insertStart.start + validationElement.length,
              puffer: '',
            };
            insertEnd.puffer = '[[[/span]]]';
            insertions.push(insertEnd);
          } else {
            insertEnd.puffer = '[[[/span]]]' + insertEnd.puffer;
          }
        }
      }

      insertions = insertions.sort((a: Pos, b: Pos) => {
        if (a.start === b.start) {
          return 0;
        } else if (a.start < b.start) {
          return -1;
        }
        return 1;
      });

      let puffer = '';
      for (const insertion of insertions) {
        const offset = puffer.length;
        const pos = insertion.start;

        result = insertString(result, pos + offset, insertion.puffer);
        puffer += insertion.puffer;
      }
    }
    return result;
  }

  public getErrorDetails(code: string): any {
    if (this.guidelines?.instructions !== undefined) {
      const instructions = this.guidelines.instructions;

      for (const instruction of instructions) {
        if (
          instruction.entries !== undefined &&
          Array.isArray(instruction.entries)
        ) {
          for (const entry of instruction.entries) {
            const newEntry = { ...entry };
            if (newEntry.code === code) {
              newEntry.description = newEntry.description.replace(
                /{{([^{}]+)}}/g,
                (g0: string, g1: string) => {
                  return this.rawToHTML(g1).replace(/(<p>)|(<\/p>)/g, '');
                }
              );
              return newEntry;
            }
          }
        }
      }
    }
    return undefined;
  }

  public requestSegment(segnumber: number) {
    this.segmentrequested.emit(segnumber);
  }

  public validateAll(
    currentLevel: OctraAnnotationSegmentLevel<Segment<ASRContext>>,
    projectSettings: ProjectSettings,
    guidelines: any
  ) {
    this._validationArray = [];

    if (
      this.appStorage.useMode !== LoginMode.URL &&
      (this.appStorage.useMode === LoginMode.DEMO ||
        projectSettings?.octra?.validationEnabled === true)
    ) {
      let invalid = false;
      if (currentLevel instanceof OctraAnnotationSegmentLevel) {
        for (let i = 0; i < currentLevel!.items.length; i++) {
          const segment = currentLevel!.items[i];

          let segmentValidation = [];
          const labelIndex = segment.labels.findIndex(
            (a) => a.name !== 'Speaker'
          );
          if (labelIndex > -1 && segment.labels[labelIndex].value.length > 0) {
            segmentValidation = this.validate(segment.labels[labelIndex].value);
          }

          this._validationArray.push({
            segment: i,
            validation: segmentValidation,
          });

          if (segmentValidation.length > 0) {
            invalid = true;
          }
        }
      }
      this._transcriptValid = !invalid;
    } else {
      this._transcriptValid = true;
    }
  }

  public getMarkerPositions(
    rawText: string,
    guidelines: any
  ): { start: number; end: number }[] {
    const result = [];
    let regexStr = '';
    for (let i = 0; i < guidelines.markers.length; i++) {
      const marker = guidelines.markers[i];
      regexStr += `(${escapeRegex(marker.code)})`;

      if (i < guidelines.markers.length - 1) {
        regexStr += '|';
      }
    }
    const regex = new RegExp(regexStr, 'g');

    let match = regex.exec(rawText);
    while (match != undefined) {
      result.push({
        start: match.index,
        end: match.index + match[0].length,
      });
      match = regex.exec(rawText);
    }

    return result;
  }

  setLevelIndex(currentLevelIndex: number) {
    this.store.dispatch(
      AnnotationActions.setLevelIndex.do({
        currentLevelIndex,
        mode: this.appStoreService.useMode!,
      })
    );
  }

  changeFeedback(feedback: any) {
    this.store.dispatch(
      AnnotationActions.changeFeedback.do({
        feedback,
      })
    );
  }

  public analyse() {
    this._statistics = {
      transcribed: 0,
      empty: 0,
      pause: 0,
    };

    if (this.currentLevel instanceof OctraAnnotationSegmentLevel) {
      for (let i = 0; i < this.currentLevel!.items.length; i++) {
        const segment = this.currentLevel!.items[i];

        if (segment.getFirstLabelWithoutName('Speaker')?.value !== '') {
          if (
            this.breakMarker !== undefined &&
            segment
              .getFirstLabelWithoutName('Speaker')!
              .value.indexOf(this.breakMarker.code) > -1
          ) {
            this._statistics.pause++;
          } else {
            this._statistics.transcribed++;
          }
        } else {
          this._statistics.empty++;
        }
      }
    }
  }

  overwriteTranscript(transcript: OctraAnnotation<ASRContext, Segment>) {
    this.store.dispatch(
      AnnotationActions.overwriteTranscript.do({
        transcript,
        mode: this.appStoreService.useMode!,
        saveToDB: true,
      })
    );
  }

  changeCurrentItemById(id: number, item: OItem | OEvent | Segment) {
    this.store.dispatch(
      AnnotationActions.changeCurrentItemById.do({
        id,
        item,
        mode: this.appStoreService.useMode!
      })
    );
  }
}
