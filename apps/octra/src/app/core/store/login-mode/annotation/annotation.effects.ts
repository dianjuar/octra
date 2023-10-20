import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { OctraAPIService } from '@octra/ngx-octra-api';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { TranslocoService } from '@ngneat/transloco';
import {
  catchError,
  exhaustMap,
  forkJoin,
  interval,
  map,
  of,
  Subscription,
  tap,
  timer,
  withLatestFrom,
} from 'rxjs';
import { getModeState, LoginMode, RootState } from '../../index';
import { OctraModalService } from '../../../modals/octra-modal.service';
import { RoutingService } from '../../../shared/service/routing.service';
import { AnnotationActions } from './annotation.actions';
import {
  AlertService,
  AudioService,
  UserInteractionsService,
} from '../../../shared/service';
import { AppInfo } from '../../../../app.info';
import {
  AnnotJSONConverter,
  convertFromSupportedConverters,
  IFile,
  ImportResult,
  ISegment,
  OctraAnnotation,
  OctraAnnotationSegment,
  OLabel,
  PraatTextgridConverter,
} from '@octra/annotation';
import { AppStorageService } from '../../../shared/service/appstorage.service';
import {
  CurrentAccountDto,
  ProjectDto,
  TaskDto,
  TaskInputOutputCreatorType,
  TaskInputOutputDto,
  ToolConfigurationAssetDto,
} from '@octra/api-types';
import { AnnotationState, GuidelinesItem } from './index';
import { LoginModeActions } from '../login-mode.actions';
import { AuthenticationActions } from '../../authentication';
import { TranscriptionSendingModalComponent } from '../../../modals/transcription-sending-modal/transcription-sending-modal.component';
import { NgbModalWrapper } from '../../../modals/ng-modal-wrapper';
import { ApplicationActions } from '../../application/application.actions';
import { ErrorModalComponent } from '../../../modals/error-modal/error-modal.component';
import {
  getTranscriptFromIO,
  hasProperty,
  SubscriptionManager,
} from '@octra/utilities';
import {
  createSampleProjectDto,
  createSampleTask,
  createSampleUser,
  StatisticElem,
} from '../../../shared';
import { checkAndThrowError } from '../../error.handlers';
import { ASRActions } from '../../asr/asr.actions';
import { SampleUnit } from '@octra/media';

import { MaintenanceAPI } from '../../../component/maintenance/maintenance-api';
import { DateTime } from 'luxon';
import { FeedBackForm } from '../../../obj/FeedbackForm/FeedBackForm';
import { FileInfo } from '@octra/web-media';

@Injectable()
export class AnnotationEffects {
  transcrSendingModal: {
    ref?: NgbModalWrapper<TranscriptionSendingModalComponent>;
    timeout?: Subscription;
    error?: string;
  } = {};

  subscrManager = new SubscriptionManager();

  startAnnotation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnnotationActions.startAnnotation.do),
      withLatestFrom(this.store),
      exhaustMap(([a, state]) => {
        // TODO write for Local and URL and DEMO
        return this.apiService
          .startTask(a.project.id, {
            task_type: 'annotation',
          })
          .pipe(
            map((task) => {
              if (task) {
                return AnnotationActions.prepareTaskDataForAnnotation.do({
                  currentProject: a.project,
                  task,
                  mode: a.mode,
                });
              }

              if (!task && a.actionAfterFail) {
                this.store.dispatch(ApplicationActions.waitForEffects.do());
                // no remaining task
                return a.actionAfterFail;
              }
              return AnnotationActions.showNoRemainingTasksModal.do();
            }),
            catchError((error: HttpErrorResponse) =>
              checkAndThrowError(
                {
                  statusCode: error.status,
                  message: error.error?.message ?? error.message,
                },
                a,
                AnnotationActions.startAnnotation.fail({
                  error: error.error?.message ?? error.message,
                  showOKButton: true,
                }),
                this.store,
                () => {
                  this.alertService.showAlert(
                    'danger',
                    error.error?.message ?? error.message
                  );
                }
              )
            )
          );
      })
    )
  );

  onPrepareTaskForAnnotation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnnotationActions.prepareTaskDataForAnnotation.do),
      withLatestFrom(this.store),
      map(([{ task, currentProject, mode }, state]) => {
        if (!task.tool_configuration) {
          return AnnotationActions.startAnnotation.fail({
            error: 'Missing tool configuration',
            showOKButton: true,
          });
        }

        if (
          !task.tool_configuration.assets ||
          task.tool_configuration.assets.length === 0
        ) {
          return AnnotationActions.startAnnotation.fail({
            error: 'Missing tool configuration assets',
            showOKButton: true,
          });
        }

        const assets = task.tool_configuration.assets;
        const guidelines: GuidelinesItem[] = this.readGuidelines(assets);

        this.addFunctions(assets);

        let selectedGuidelines: GuidelinesItem | undefined = undefined;

        if (guidelines.length > 0) {
          if (state.application.language) {
            if (guidelines.length === 1) {
              selectedGuidelines = guidelines[0];
            } else {
              const found = guidelines.find(
                (a) =>
                  new RegExp(
                    `_${state.application.language.toLowerCase()}.json`
                  ).exec(a.filename) !== null
              );
              selectedGuidelines = found ?? guidelines[0];
            }
          } else {
            selectedGuidelines = guidelines[0];
          }
        }

        return AnnotationActions.startAnnotation.success({
          task,
          project: currentProject,
          mode,
          projectSettings: task.tool_configuration.value,
          guidelines,
          selectedGuidelines,
        });
      })
    )
  );

  onAnnotationStart$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.startAnnotation.success),
        withLatestFrom(this.store),
        tap(([a, state]) => {
          // INIT UI SERVICE
          const modeState = getModeState(state)!;
          if (a.projectSettings.logging || modeState.logging.enabled) {
            this.uiService.init(
              true,
              modeState.logging.startTime,
              modeState.logging.startReference
            );
            this.uiService.elements = modeState.logging.logs.map((a) =>
              StatisticElem.fromAny(a)
            );
            this.uiService.addElementFromEvent(
              'octra',
              { value: AppInfo.version },
              Date.now(),
              undefined,
              undefined,
              undefined,
              undefined,
              'version'
            );
            this.subscrManager.removeByTag('uiService');
            this.subscrManager.add(
              this.uiService.afteradd.subscribe({
                next: (item: StatisticElem) => {
                  this.store.dispatch(
                    AnnotationActions.addLog.do({
                      mode: state.application.mode!,
                      log: item.getDataClone(),
                    })
                  );
                },
              }),
              'uiService'
            );
          }

          this.routingService.navigate('start annotation', ['/load/']);
          this.store.dispatch(
            AnnotationActions.loadAudio.do({
              audioFile: a.task.inputs.find(
                (a) => a.fileType!.indexOf('audio') > -1
              ),
              mode: a.mode,
            })
          );
        })
      ),
    { dispatch: false }
  );

  setLogging$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.setLogging.do),
        withLatestFrom(this.store),
        tap(([action, state]) => {
          const modeState = getModeState(state)!;
          this.uiService.init(
            action.logging,
            modeState.logging.startTime,
            modeState.logging.startReference
          );
        })
      ),
    { dispatch: false }
  );

  onAudioLoad$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.loadAudio.do),
        withLatestFrom(this.store),
        tap(([a, state]) => {
          if (state.application.mode === undefined || !a.audioFile) {
            this.store.dispatch(
              AnnotationActions.loadAudio.fail({
                error: `An error occured. Please click on "Back" and try it again.`,
              })
            );
            return;
          }

          let filename = a.audioFile!.filename;
          if (
            state.application.mode === LoginMode.ONLINE ||
            state.application.mode === LoginMode.URL ||
            state.application.mode === LoginMode.DEMO
          ) {
            // online, url or demo
            if (a.audioFile) {
              const src = this.apiService.prepareFileURL(a.audioFile!.url!);
              // extract filename

              filename = filename.substring(0, filename.lastIndexOf('.'));

              if (filename.indexOf('src=') > -1) {
                filename = filename.substring(filename.indexOf('src=') + 4);
              }

              this.audio.loadAudio(src, a.audioFile).subscribe({
                next: (progress) => {
                  if (progress < 1) {
                    this.store.dispatch(
                      AnnotationActions.loadAudio.progress({
                        value: progress,
                        mode: state.application.mode!,
                      })
                    );
                  } else {
                    this.store.dispatch(
                      AnnotationActions.loadAudio.success({
                        mode: state.application.mode!,
                        audioFile: a.audioFile,
                      })
                    );
                  }
                },
                error: (err) => {
                  this.store.dispatch(
                    AnnotationActions.loadAudio.fail({
                      error: 'Loading audio file failed<br/>',
                    })
                  );
                  console.error(err);
                },
              });
            } else {
              this.store.dispatch(
                AnnotationActions.loadAudio.fail({
                  error: `No audio source found. Please click on "Back" and try it again.`,
                })
              );
              console.error('audio src is undefined');
            }
          } else if (state.application.mode === LoginMode.LOCAL) {
            // local mode
            if (state.localMode.sessionFile !== undefined) {
              if (this.audio.audiomanagers.length > 0) {
                this.store.dispatch(
                  AnnotationActions.loadAudio.success({
                    mode: LoginMode.LOCAL,
                    audioFile: a.audioFile,
                  })
                );
              } else {
                this.store.dispatch(
                  AnnotationActions.loadAudio.fail({
                    error: 'audio from sessionfile not loaded. Reload needed.',
                  })
                );
              }
            } else {
              this.store.dispatch(
                AnnotationActions.loadAudio.fail({
                  error: 'sessionfile is undefined',
                })
              );
            }
          }
        })
      ),
    { dispatch: false }
  );

  onAnnotationLoadFailed$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.loadAudio.fail),
        withLatestFrom(this.store),
        tap(([a, state]) => {
          if (state.application.mode === LoginMode.LOCAL) {
            this.routingService
              .navigate(
                'reload audio local',
                ['/intern/transcr/reload-file'],
                AppInfo.queryParamsHandling
              )
              .catch((error) => {
                console.error(error);
              });
          }
        })
      ),
    { dispatch: false }
  );

  onTranscriptionEnd$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(LoginModeActions.endTranscription.do),
        tap((a) => {
          this.routingService.navigate(
            'end transcription',
            ['/intern/transcr/end'],
            AppInfo.queryParamsHandling
          );
          this.audio.destroy(true);
        })
      ),
    { dispatch: false }
  );

  onQuit$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnnotationActions.quit.do),
      withLatestFrom(this.store),
      exhaustMap(([a, state]) => {
        this.store.dispatch(ApplicationActions.waitForEffects.do());

        if (state.application.mode === LoginMode.ONLINE) {
          if (
            a.freeTask &&
            state.onlineMode.currentSession.currentProject &&
            state.onlineMode.currentSession.task
          ) {
            return this.apiService
              .freeTask(
                state.onlineMode.currentSession.currentProject.id,
                state.onlineMode.currentSession.task.id
              )
              .pipe(
                map((result) => {
                  if (a.redirectToProjects) {
                    return AnnotationActions.redirectToProjects.do();
                  } else {
                    return AuthenticationActions.logout.do({
                      clearSession: a.clearSession,
                      mode: state.application.mode!,
                    });
                  }
                }),
                catchError((error) =>
                  checkAndThrowError(
                    {
                      statusCode: error.status,
                      message: error.error?.message ?? error.message,
                    },
                    a,
                    AuthenticationActions.logout.do({
                      clearSession: a.clearSession,
                      mode: state.application.mode!,
                    }),
                    this.store,
                    () => {
                      this.alertService.showAlert(
                        'danger',
                        error.error?.message ?? error.message
                      );
                    }
                  )
                )
              );
          } else {
            if (a.redirectToProjects) {
              return of(AnnotationActions.redirectToProjects.do());
            } else {
              return of(
                AuthenticationActions.logout.do({
                  clearSession: a.clearSession,
                  mode: state.application.mode,
                })
              );
            }
          }
        } else {
          return of(
            AuthenticationActions.logout.do({
              clearSession: a.clearSession,
              mode: state.application.mode!,
            })
          );
        }
      })
    )
  );

  showNoRemainingTasksModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.showNoRemainingTasksModal.do),
        tap((a) => {
          const ref = this.modalsService.openModalRef(
            ErrorModalComponent,
            ErrorModalComponent.options
          );
          (ref.componentInstance as ErrorModalComponent).text =
            this.transloco.translate('projects-list.no remaining tasks');
        })
      ),
    { dispatch: false }
  );

  afterLogoutSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthenticationActions.logout.success),
        withLatestFrom(this.store),
        tap(([action, state]) => {
          this.audio.destroy(true);
        })
      ),
    { dispatch: false }
  );

  loadSegments$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnnotationActions.initTranscriptionService.do),
      withLatestFrom(this.store),
      exhaustMap(([a, state]) => {
        this.initMaintenance(state);
        if (
          state.application.mode === LoginMode.URL &&
          state.application.queryParams!.transcript !== undefined
        ) {
          // load transcript file via URL
          return this.http
            .get(state.application.queryParams!.transcript, {
              responseType: 'text',
            })
            .pipe(
              map((content) => {
                let filename = state.application.queryParams!.transcript;
                filename = filename.substring(filename.lastIndexOf('/') + 1);

                const file: IFile = {
                  name: filename,
                  content,
                  type: 'text',
                  encoding: 'utf-8',
                };

                // convert par to annotJSON
                const oAudioFile =
                  this.audio.audioManager.resource.getOAudioFile();

                let importResult: ImportResult | undefined;
                // find valid converter...
                for (const converter of AppInfo.converters) {
                  if (filename.indexOf(converter.extension) > -1) {
                    // test converter
                    const tempImportResult = converter.import(file, oAudioFile);

                    if (
                      tempImportResult !== undefined &&
                      tempImportResult.error === ''
                    ) {
                      importResult = tempImportResult;
                      break;
                    } else {
                      console.error(tempImportResult!.error);
                    }
                  }
                }

                if (
                  importResult !== undefined &&
                  !(importResult.annotjson === undefined)
                ) {
                  return AnnotationActions.initTranscriptionService.success({
                    mode: state.application.mode!,
                    transcript: OctraAnnotation.deserialize(
                      importResult.annotjson
                    ),
                    saveToDB: false,
                  });
                } else {
                  return AnnotationActions.initTranscriptionService.fail({
                    error: "Can't import transcript",
                  });
                }
              })
            );
        } else {
          if (this.appStorage.useMode === LoginMode.URL) {
            // overwrite with empty level
            const newAnnotation = new OctraAnnotation();
            return of(
              AnnotationActions.initTranscriptionService.success({
                mode: state.application.mode!,
                transcript: newAnnotation,
                saveToDB: false,
              })
            );
          } else {
            // it's not URL mode
            return this.loadSegments(getModeState(state)!, state);
          }
        }
      })
    )
  );

  loadSegmentsSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.initTranscriptionService.success),
        withLatestFrom(this.store),
        tap(([action, state]) => {
          this.routingService.navigate(
            'transcription initialized',
            ['/intern/transcr'],
            AppInfo.queryParamsHandling
          );
        })
      ),
    { dispatch: false }
  );

  onAudioLoadSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.loadAudio.success),
        withLatestFrom(this.store),
        tap(([a, state]) => {
          this.store.dispatch(
            AnnotationActions.initTranscriptionService.do({
              mode: state.application.mode!,
            })
          );
        })
      ),
    { dispatch: false }
  );

  onLoadOnlineInfo$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LoginModeActions.loadProjectAndTaskInformation.do),
      withLatestFrom(this.store),
      exhaustMap(([a, state]) => {
        if (a.mode === LoginMode.ONLINE) {
          return forkJoin<
            [CurrentAccountDto, ProjectDto | undefined, TaskDto | undefined]
          >(
            this.apiService.getMyAccountInformation(),
            this.apiService
              .getProject(a.projectID)
              .pipe(catchError((a) => of(undefined))),
            this.apiService
              .getTask(a.projectID, a.taskID)
              .pipe(catchError((a) => of(undefined)))
          ).pipe(
            map(([currentAccount, currentProject, task]) => {
              if (currentProject && task) {
                if (!a.actionAfterSuccess) {
                  // normal load after task start or resuming session
                  return LoginModeActions.loadProjectAndTaskInformation.success(
                    {
                      mode: LoginMode.ONLINE,
                      me: currentAccount,
                      currentProject,
                      task,
                    }
                  );
                }

                return LoginModeActions.loadProjectAndTaskInformation.success({
                  mode: LoginMode.ONLINE,
                  me: currentAccount,
                  currentProject,
                  task,
                  actionAfterSuccess: a.actionAfterSuccess,
                });
              } else {
                return LoginModeActions.loadProjectAndTaskInformation.success({
                  mode: LoginMode.ONLINE,
                  me: currentAccount,
                  currentProject,
                  task,
                  actionAfterSuccess: a.actionAfterSuccess,
                });
              }
            }),
            catchError((error: HttpErrorResponse) => {
              return checkAndThrowError(
                {
                  statusCode: error.status,
                  message: error.error?.message ?? error.message,
                },
                a,
                LoginModeActions.loadProjectAndTaskInformation.fail({
                  error,
                }),
                this.store,
                () => {
                  this.alertService.showAlert(
                    'danger',
                    error.error?.message ?? error.message
                  );
                }
              );
            })
          );
        } else if (
          [LoginMode.DEMO, LoginMode.ONLINE, LoginMode.LOCAL].includes(a.mode)
        ) {
          // mode is not online => load configuration for local environment
          return forkJoin<
            [
              any,
              (
                | {
                    language: string;
                    json: any;
                  }
                | undefined
              )[],
              any
            ]
          >([
            this.http.get('config/localmode/projectconfig.json', {
              responseType: 'json',
            }),
            forkJoin(
              state.application.appConfiguration!.octra.languages.map(
                (b: string) =>
                  this.http
                    .get(`config/localmode/guidelines/guidelines_${b}.json`, {
                      responseType: 'json',
                    })
                    .pipe(
                      map((c) => ({
                        language: b,
                        json: c,
                      })),
                      catchError(() => of(undefined))
                    )
              )
            ),
            this.http.get('config/localmode/functions.js', {
              responseType: 'text',
            }),
          ]).pipe(
            map(([projectConfig, guidelines, functions]) => {
              const currentProject = createSampleProjectDto(a.projectID);

              const inputs: TaskInputOutputDto[] =
                state.application.mode === LoginMode.DEMO
                  ? state.application
                      .appConfiguration!.octra.audioExamples.map((a) => ({
                        filename: FileInfo.fromURL(a.url).fullname,
                        fileType: 'audio/wave',
                        type: 'input',
                        url: a.url,
                        creator_type: TaskInputOutputCreatorType.user,
                        content: '',
                        content_type: '',
                      }))
                      .slice(0, 1)
                  : [
                      {
                        filename: state.localMode.sessionFile!.name,
                        fileType: state.localMode.sessionFile!.type,
                        type: 'input',
                        creator_type: TaskInputOutputCreatorType.user,
                        content: '',
                        content_type: '',
                      },
                    ];
              const task = createSampleTask(
                a.taskID,
                inputs,
                [],
                projectConfig,
                functions,
                guidelines,
                {
                  orgtext: [LoginMode.ONLINE, LoginMode.DEMO].includes(
                    state.application.mode!
                  )
                    ? state.application.appConfiguration!.octra.audioExamples[0]
                        .description
                    : '',
                }
              );

              return LoginModeActions.loadProjectAndTaskInformation.success({
                mode: a.mode,
                me: createSampleUser(),
                currentProject,
                task,
              });
            })
          );
        }
        return of();
      })
    )
  );

  onAnnotationSend$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnnotationActions.sendAnnotation.do),
      withLatestFrom(this.store),
      exhaustMap(([a, state]) => {
        if (state.application.mode === LoginMode.ONLINE) {
          this.transcrSendingModal.timeout = timer(2000).subscribe({
            next: () => {
              this.transcrSendingModal.ref = this.modalsService.openModalRef(
                TranscriptionSendingModalComponent,
                TranscriptionSendingModalComponent.options
              );
              this.transcrSendingModal.ref.componentInstance.error =
                this.transcrSendingModal.error ?? '';
            },
          });

          if (
            !state.onlineMode.currentSession.currentProject ||
            !state.onlineMode.currentSession.task?.id
          ) {
            return of(
              AnnotationActions.sendAnnotation.fail({
                mode: state.application.mode!,
                error: 'Current project or current task is undefined',
              })
            );
          }
          const result = new AnnotJSONConverter().export(
            state.onlineMode.transcript
              .clone()
              .serialize(
                this.audio.audioManager.resource.info.fullname,
                this.audio.audioManager.resource.info.sampleRate,
                this.audio.audioManager.resource.info.duration.clone()
              )
          )?.file?.content;

          const outputs = result
            ? [
                new File(
                  [result],
                  state.onlineMode.audio.fileName.substring(
                    0,
                    state.onlineMode.audio.fileName.lastIndexOf('.')
                  ) + '_annot.json',
                  {
                    type: 'application/json',
                  }
                ),
              ]
            : [];

          return this.apiService
            .saveTask(
              state.onlineMode.currentSession.currentProject.id,
              state.onlineMode.currentSession.task.id,
              {
                assessment: state.onlineMode.currentSession.assessment,
                comment: state.onlineMode.currentSession.comment,
                log: state.onlineMode.logging.logs,
              },
              outputs
            )
            .pipe(
              map((a) => {
                return AnnotationActions.sendAnnotation.success({
                  mode: state.application.mode!,
                  task: a,
                });
              }),
              catchError((error: HttpErrorResponse) => {
                if (error.status === 401) {
                  this.transcrSendingModal.timeout?.unsubscribe();
                }

                return checkAndThrowError(
                  {
                    statusCode: error.status,
                    message: error.error?.message ?? error.message,
                  },
                  a,
                  AnnotationActions.sendAnnotation.fail({
                    mode: state.application.mode!,
                    error: error.error?.message ?? error.message,
                  }),
                  this.store,
                  () => {
                    if (this.transcrSendingModal.ref) {
                      this.transcrSendingModal.ref.componentInstance.error =
                        error.error?.message ?? error.message;
                      /* TODO if error is because of not busy => select new annotation? */
                    }
                  }
                );
              })
            );
        } else {
          // TODO add other modes
        }
        return of(
          AnnotationActions.sendAnnotation.fail({
            mode: state.application.mode!,
            error: 'Not implemented',
          })
        );
      })
    )
  );

  sendAnnotationFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.sendAnnotation.fail),
        withLatestFrom(this.store),
        tap(([action, state]) => {
          this.transcrSendingModal.timeout?.unsubscribe();
          this.transcrSendingModal.ref?.close();

          this.modalsService.openErrorModal(action.error);
        })
      ),
    { dispatch: false }
  );

  afterAnnotationSent$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnnotationActions.sendAnnotation.success),
      withLatestFrom(this.store),
      exhaustMap(([a, state]) => {
        this.transcrSendingModal.timeout?.unsubscribe();
        this.transcrSendingModal.ref?.close();

        this.alertService.showAlert(
          'success',
          this.transloco.translate('g.submission success'),
          true,
          2000
        );

        this.store.dispatch(ApplicationActions.waitForEffects.do());

        return of(
          LoginModeActions.clearOnlineSession.do({
            mode: a.mode,
            actionAfterSuccess: AnnotationActions.startAnnotation.do({
              mode: a.mode,
              project: state.onlineMode.currentSession.currentProject!,
              actionAfterFail: LoginModeActions.endTranscription.do({
                clearSession: true,
                mode: LoginMode.ONLINE,
              }),
            }),
          })
        );
      })
    )
  );

  afterClearOnlineSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LoginModeActions.clearOnlineSession.do),
      exhaustMap((a) => {
        this.audio.destroy(true);
        return of(a.actionAfterSuccess);
      })
    )
  );

  redirectToProjects$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnnotationActions.redirectToProjects.do),
      exhaustMap((a) => {
        this.routingService.navigate(
          'redirect to projects after quit',
          ['/intern/projects'],
          AppInfo.queryParamsHandling
        );
        return of(AnnotationActions.redirectToProjects.success());
      })
    )
  );

  resumeTaskManually$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AnnotationActions.resumeTaskManually.do),
      withLatestFrom(this.store),
      exhaustMap(([a, state]) => {
        const modeState = getModeState(state);

        if (
          modeState?.currentSession?.currentProject &&
          modeState?.currentSession?.task
        ) {
          return of(
            AnnotationActions.prepareTaskDataForAnnotation.do({
              mode: state.application.mode!,
              currentProject: modeState.currentSession.currentProject,
              task: modeState.currentSession.task,
            })
          );
        }

        return of();
      })
    )
  );

  redirectToTranscription$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.redirectToTranscription.do),
        tap((a) => {
          this.routingService.navigate(
            'redirect to transcription loadOnlineInformationAfterIDBLoaded',
            ['/intern/transcr'],
            AppInfo.queryParamsHandling
          );
        })
      ),
    { dispatch: false }
  );

  asrRunWordAlignmentSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ASRActions.runWordAlignmentOnItem.success),
      withLatestFrom(this.store),
      exhaustMap(([{ item, result }, state]) => {
        const converter = new PraatTextgridConverter();
        const audioManager = this.audio.audioManager;
        const audiofile = audioManager.resource.getOAudioFile();
        audiofile.name = `OCTRA_ASRqueueItem_${item.id}.wav`;

        if (result) {
          const convertedResult = converter.import(
            {
              name: `OCTRA_ASRqueueItem_${item.id}.TextGrid`,
              content: result,
              type: 'text',
              encoding: 'utf-8',
            },
            audiofile
          );

          if (convertedResult?.annotjson) {
            const wordsTier = convertedResult.annotjson.levels.find(
              (a: any) => {
                return a.name === 'ORT-MAU';
              }
            );

            if (wordsTier !== undefined) {
              let counter = 0;

              const segmentBoundary = new SampleUnit(
                item.time.sampleStart + item.time.sampleLength,
                audioManager.sampleRate
              );
              const segmentIndex =
                getModeState(
                  state
                )!.transcript.getCurrentSegmentIndexBySamplePosition(
                  segmentBoundary
                );

              if (segmentIndex < 0) {
                return of(
                  AnnotationActions.addMultipleASRSegments.fail({
                    error: `could not find segment to be precessed by ASRMAUS!`,
                  })
                );
              } else {
                const segmentID =
                  getModeState(state)!.transcript.currentLevel!.items[
                    segmentIndex
                  ].id;
                const newSegments: OctraAnnotationSegment[] = [];

                let itemCounter =
                  getModeState(state)?.transcript.idCounters.item ?? 1;
                for (const wordItem of wordsTier.items as ISegment[]) {
                  const itemEnd =
                    item.time.sampleStart + item.time.sampleLength;
                  if (
                    item.time.sampleStart +
                      wordItem.sampleStart +
                      wordItem.sampleDur <=
                    itemEnd
                  ) {
                    const readSegment = new OctraAnnotationSegment(
                      itemCounter++,
                      new SampleUnit(
                        item.time.sampleStart +
                          wordItem.sampleStart +
                          wordItem.sampleDur,
                        this.audio.audioManager.resource.info.sampleRate
                      ),
                      wordItem.labels.map((a) =>
                        OLabel.deserialize({
                          ...a,
                          name:
                            a.name === 'ORT-MAU'
                              ? getModeState(state)!.transcript!.currentLevel!
                                  .name!
                              : a.name,
                        })
                      )
                    );

                    const labelIndex = readSegment.labels.findIndex(
                      (a) => a.value === '<p:>' || a.value === ''
                    );

                    if (labelIndex > -1) {
                      readSegment.labels[labelIndex].value =
                        getModeState(
                          state
                        )!.guidelines?.selected?.json.markers.find(
                          (a) => a.type === 'break'
                        )?.code ?? '';
                    }

                    newSegments.push(readSegment);
                    // the last segment is the original segment
                  } else {
                    // tslint:disable-next-line:max-line-length
                    console.error(
                      `${wordItem.sampleStart} + ${wordItem.sampleDur} <= ${item.time.sampleStart} + ${item.time.sampleLength}`
                    );
                    return of(
                      AnnotationActions.addMultipleASRSegments.fail({
                        error: `wordItem samples are out of the correct boundaries.`,
                      })
                    );
                  }
                  counter++;
                }
                return of(
                  AnnotationActions.addMultipleASRSegments.success({
                    mode: state.application.mode!,
                    segmentID,
                    newSegments,
                  })
                );
              }
            } else {
              return of(
                AnnotationActions.addMultipleASRSegments.fail({
                  error: 'word tier not found!',
                })
              );
            }
          } else {
            return of(
              AnnotationActions.addMultipleASRSegments.fail({
                error: 'importresult ist undefined',
              })
            );
          }
        } else {
          return of(
            AnnotationActions.addMultipleASRSegments.fail({
              error: 'Result is undefined',
            })
          );
        }
      })
    )
  );

  private addFunctions(assets: ToolConfigurationAssetDto[]) {
    const functionsObj = assets.find((a) => a.name === 'functions');

    const script = document.createElement('script');
    script.type = 'application/javascript';
    script.id = 'octra_functions';
    if (functionsObj) {
      script.innerHTML = functionsObj.content;
    } else {
      script.innerHTML = `
                  function validateAnnotation(annotation, guidelines) { return []; }
                  function tidyUpAnnotation(annotation, guidelines) { return annotation; }
                `;
    }

    document.head.querySelector('#octra_functions')?.remove();
    document.head.appendChild(script);
  }

  private readGuidelines(
    assets: ToolConfigurationAssetDto[]
  ): GuidelinesItem[] {
    return assets
      .filter((a) => a.name === 'guidelines')
      .map((a) => {
        try {
          return {
            filename: a.filename!,
            name: a.name,
            json:
              typeof a.content === 'string' ? JSON.parse(a.content) : a.content,
            type: a.mime_type,
          };
        } catch (e) {
          return {
            filename: a.filename!,
            name: a.name,
            json: undefined,
            type: a.mime_type,
          };
        }
      });
  }

  private loadSegments(modeState: AnnotationState, rootState: RootState) {
    let feedback: FeedBackForm | undefined = undefined;
    if (
      modeState.transcript.levels === undefined ||
      modeState.transcript.levels.length === 0
    ) {
      // create new annotation
      let newAnnotation = new OctraAnnotation();

      if (
        rootState.application.mode === LoginMode.ONLINE ||
        rootState.application.mode === LoginMode.URL
      ) {
        let annotResult: ImportResult | undefined;
        const task: TaskDto | undefined = modeState.currentSession?.task;

        // import logs
        this.store.dispatch(
          AnnotationActions.saveLogs.do({
            logs: modeState.logging.logs ?? task?.log ?? [],
            mode: rootState.application.mode,
          })
        );

        const serverTranscript = task
          ? getTranscriptFromIO(task.outputs) ??
            getTranscriptFromIO(task.inputs)
          : '';

        if (serverTranscript) {
          // check if it's AnnotJSON
          annotResult = convertFromSupportedConverters(
            AppInfo.converters,
            {
              name: `${this.audio.audioManager.resource.info.name}_annot.json`,
              content: serverTranscript.content,
              type: serverTranscript.fileType!,
              encoding: 'utf-8',
            },
            this.audio.audioManager.resource.getOAudioFile()
          );

          // import servertranscript
          if (annotResult && annotResult.annotjson) {
            newAnnotation = OctraAnnotation.deserialize(annotResult.annotjson);
          }
        }

        if (!annotResult) {
          // no transcript found
          if (task) {
            const textInput = getTranscriptFromIO(task.inputs);
            if (textInput) {
              // prompt text available and server transcript is undefined
              // set prompt as new transcript

              // check if prompttext ist a transcription format like AnnotJSON
              const converted: ImportResult | undefined =
                convertFromSupportedConverters(
                  AppInfo.converters,
                  {
                    name: this.audio.audioManager.resource.name,
                    content: textInput.content,
                    type: 'text',
                    encoding: 'utf8',
                  },
                  this.audio.audioManager.resource.getOAudioFile()
                );

              if (converted === undefined) {
                // prompttext is raw text
                newAnnotation.levels[0].items[0].labels[0] = new OLabel(
                  'OCTRA_1',
                  textInput.content
                );
              } else if (converted.annotjson) {
                // use imported annotJSON
                newAnnotation = OctraAnnotation.deserialize(
                  converted.annotjson
                );
              }
            }
          }
        }

        if (newAnnotation.levels.length === 0) {
          const level = newAnnotation.createSegmentLevel('OCTRA_1');
          level.items.push(
            newAnnotation.createSegment(
              this.audio.audioManager.resource.info.duration,
              [
                new OLabel('OCTRA_1', ''), // empty transcript
              ]
            )
          );
          newAnnotation.addLevel(level);
          newAnnotation.changeLevelIndex(0);
        } else {
          const currentLevelIndex =
            modeState.previousCurrentLevel === undefined ||
            modeState.previousCurrentLevel === null ||
            modeState.previousCurrentLevel >= newAnnotation.levels.length
              ? Math.max(
                  0,
                  newAnnotation.levels.findIndex((a) => a.type === 'SEGMENT')
                )
              : modeState.previousCurrentLevel;

          newAnnotation.changeCurrentLevelIndex(currentLevelIndex);
        }
      } else {
        // not URL oder ONLINE MODE, Annotation is null

        const level = newAnnotation.createSegmentLevel('OCTRA_1');
        level.items.push(
          newAnnotation.createSegment(
            this.audio.audioManager.resource.info.duration,
            [
              new OLabel('OCTRA_1', ''), // empty transcript
            ]
          )
        );
        newAnnotation.addLevel(level);
        newAnnotation.changeLevelIndex(0);

        const projectSettings =
          getModeState(rootState)!.currentSession.task!.tool_configuration!
            .value;
        if (projectSettings) {
          feedback = FeedBackForm.fromAny(
            projectSettings.feedback_form,
            modeState.currentSession.comment ?? ''
          );
        }
        if (feedback) {
          feedback?.importData(feedback);

          if (modeState.currentSession.comment !== undefined) {
            feedback.comment = modeState.currentSession.comment;
          }
        }

        if (this.appStorage.logs === undefined) {
          this.appStorage.clearLoggingDataPermanently();
          this.uiService.elements = [];
        } else if (Array.isArray(this.appStorage.logs)) {
          this.uiService.fromAnyArray(this.appStorage.logs);
        }

        this.uiService.addElementFromEvent(
          'octra',
          { value: AppInfo.version },
          Date.now(),
          undefined,
          undefined,
          undefined,
          undefined,
          'version'
        );
      }

      if (
        rootState.application.options.showFeedbackNotice &&
        this.apiService.appFeatures?.send_feedback
      ) {
        this.modalsService.openFeedbackModal();
      }

      // new annotation set
      return of(
        AnnotationActions.initTranscriptionService.success({
          mode: rootState.application.mode!,
          transcript: newAnnotation,
          feedback,
          saveToDB: true,
        })
      );
    }

    const transcript = modeState.transcript.changeSampleRate(
      this.audio.audioManager.resource.info.sampleRate
    );

    const currentLevelIndex =
      modeState.previousCurrentLevel === undefined ||
      modeState.previousCurrentLevel === null ||
      modeState.previousCurrentLevel >= transcript.levels.length
        ? Math.max(
            0,
            transcript.levels.findIndex((a) => a.type === 'SEGMENT')
          )
        : modeState.previousCurrentLevel;
    transcript.changeCurrentLevelIndex(currentLevelIndex);

    if (
      rootState.application.options.showFeedbackNotice &&
      this.apiService.appFeatures?.send_feedback
    ) {
      this.modalsService.openFeedbackModal();
    }

    return of(
      AnnotationActions.initTranscriptionService.success({
        mode: rootState.application.mode!,
        feedback,
        transcript,
        saveToDB: false,
      })
    );
  }

  levelIndexChange$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AnnotationActions.setLevelIndex.do),
        withLatestFrom(this.store),
        tap(([action, state]) => {
          this.uiService.addElementFromEvent(
            'level',
            { value: 'changed' },
            Date.now(),
            this.audio.audioManager.createSampleUnit(0),
            undefined,
            undefined,
            undefined,
            getModeState(state)?.transcript?.levels[action.currentLevelIndex]
              ?.name
          );
        })
      ),
    { dispatch: false }
  );

  public initMaintenance(state: RootState) {
    if (
      state.application.appConfiguration !== undefined &&
      hasProperty(
        state.application.appConfiguration.octra,
        'maintenanceNotification'
      ) &&
      state.application.appConfiguration.octra.maintenanceNotification
        .active === 'active'
    ) {
      const maintenanceAPI = new MaintenanceAPI(
        state.application.appConfiguration.octra.maintenanceNotification.apiURL,
        this.http
      );

      maintenanceAPI
        .readMaintenanceNotifications(24)
        .then((notification) => {
          // only check in interval if there is a pending maintenance in the next 24 hours
          if (notification !== undefined) {
            const readNotification = () => {
              // notify after 15 minutes one hour before the maintenance begins
              maintenanceAPI
                .readMaintenanceNotifications(1)
                .then((notification2) => {
                  if (notification2 !== undefined) {
                    this.alertService.showAlert(
                      'warning',
                      '⚠️ ' +
                        this.transloco.translate('maintenance.in app', {
                          start: DateTime.fromISO(notification.begin)
                            .setLocale(this.appStorage.language)
                            .toLocaleString(DateTime.DATETIME_SHORT),
                          end: DateTime.fromISO(notification.end)
                            .setLocale(this.appStorage.language)
                            .toLocaleString(DateTime.DATETIME_SHORT),
                        }),
                      true,
                      60
                    );
                  }
                })
                .catch(() => {
                  // ignore
                });
            };

            if (this.maintenanceChecker !== undefined) {
              this.maintenanceChecker.unsubscribe();
            }

            // run each 15 minutes
            this.maintenanceChecker = interval(15 * 60000).subscribe(
              readNotification
            );
          }
        })
        .catch(() => {
          // ignore
        });
    }
  }

  private maintenanceChecker?: Subscription;

  constructor(
    private actions$: Actions,
    private store: Store<RootState>,
    private apiService: OctraAPIService,
    private http: HttpClient,
    private alertService: AlertService,
    private routingService: RoutingService,
    private modalsService: OctraModalService,
    private audio: AudioService,
    private uiService: UserInteractionsService,
    private appStorage: AppStorageService,
    private transloco: TranslocoService
  ) {}
}
