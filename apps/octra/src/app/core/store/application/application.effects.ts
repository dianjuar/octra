import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Action, Store } from '@ngrx/store';
import { LocalStorageService, SessionStorageService } from 'ngx-webstorage';
import { ApplicationActions } from '../application/application.actions';
import { LoginModeActions } from '../login-mode';
import {
  catchError,
  exhaustMap,
  forkJoin,
  map,
  of,
  Subject,
  tap,
  timer,
  withLatestFrom,
} from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { APIActions } from '../api';
import { getBrowserLang, TranslocoService } from '@ngneat/transloco';
import { uniqueHTTPRequest } from '@octra/ngx-utilities';
import { ConfigurationService } from '../../shared/service/configuration.service';
import { AppConfigSchema } from '../../schemata/appconfig.schema';
import { AppInfo } from '../../../app.info';
import {
  BugReportService,
  ConsoleType,
} from '../../shared/service/bug-report.service';
import { AppSettings } from '../../obj';
import { IDBActions } from '../idb/idb.actions';
import { AppStorageService } from '../../shared/service/appstorage.service';
import { SettingsService } from '../../shared/service';
import { getModeState, RootState } from '../index';
import { AuthenticationActions } from '../authentication';
import { RoutingService } from '../../shared/service/routing.service';
import { Params } from '@angular/router';
import { AnnotationActions } from '../login-mode/annotation/annotation.actions';
import { OctraModalService } from '../../modals/octra-modal.service';
import { ErrorModalComponent } from '../../modals/error-modal/error-modal.component';
import { environment } from '../../../../environments/environment';
import { findElements, getAttr } from '@octra/web-media';

@Injectable({
  providedIn: 'root',
})
export class ApplicationEffects {
  initApp$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApplicationActions.initApplication.do),
      exhaustMap(() => {
        this.initConsoleLogging();
        return of(ApplicationActions.loadLanguage.do());
      })
    )
  );

  loadSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApplicationActions.loadSettings.do),
      exhaustMap((a) => {
        return forkJoin([
          uniqueHTTPRequest(
            this.http,
            false,
            {
              responseType: 'json',
            },
            'config/appconfig.json',
            undefined
          ),
        ]).pipe(
          map(([appconfig]) => {
            const validation = this.configurationService.validateJSON(
              appconfig,
              AppConfigSchema
            );

            if (validation.length === 0) {
              return ApplicationActions.loadSettings.success({
                settings: appconfig,
              });
            } else {
              return ApplicationActions.loadSettings.fail({
                error: `<br/><ul>${validation
                  .map(
                    (v) =>
                      '<li><b>' +
                      v.instancePath +
                      '</b>:<br/>' +
                      v.message +
                      '</li>'
                  )
                  .join('<br/>')}</ul>`,
              });
            }
          }),
          catchError((err: HttpErrorResponse) => {
            return of(
              ApplicationActions.loadSettings.fail({
                error: err.error?.message ?? err.message,
              })
            );
          })
        );
      })
    )
  );

  loadASRSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApplicationActions.loadASRSettings.do),
      exhaustMap(({ settings }) => {
        // load information from BASWebservices ASR page
        if (
          settings.octra.plugins?.asr?.asrInfoURL !== undefined &&
          typeof settings.octra.plugins.asr.asrInfoURL === 'string' &&
          settings.octra.plugins.asr.asrInfoURL
        ) {
          return this.http
            .get(settings.octra.plugins.asr.asrInfoURL, {
              responseType: 'text',
            })
            .pipe(
              map((result) => {
                if (!settings.octra.plugins?.asr?.services) {
                  return ApplicationActions.loadSettings.fail({
                    error:
                      'Missing asr.services property in application settings.',
                  });
                }

                const document = new DOMParser().parseFromString(
                  result,
                  'text/html'
                );
                const basTable = document.getElementById(
                  '#bas-asr-service-table'
                );
                const basASRInfoContainers = findElements(
                  basTable!,
                  '.bas-asr-info-container'
                );

                const asrInfos: {
                  name: string;
                  maxSignalDuration: number;
                  maxSignalSize: number;
                  quotaPerMonth: number;
                  termsURL: string;
                  dataStoragePolicy: string;
                  knownIssues: string;
                }[] = [];

                for (const basASRInfoContainer of basASRInfoContainers) {
                  const isStringNumber = (str: string) => !isNaN(Number(str));
                  const sanitizeNumberValue = (el: any, attr: string) => {
                    if (el[attr] !== undefined && isStringNumber(el[attr])) {
                      el[attr] = Number(el[attr]);
                    } else {
                      el[attr] = undefined;
                    }
                  };
                  const sanitizeStringValue = (el: any, attr: string) => {
                    if (
                      el[attr] !== undefined &&
                      typeof el[attr] === 'string'
                    ) {
                      el[attr] = el[attr].replace(/[\n\t\r]+/g, '');
                    } else {
                      el[attr] = undefined;
                    }
                  };

                  const maxSignalDurationSpans = findElements(
                    basASRInfoContainer,
                    '.bas-asr-info-max-signal-duration-seconds'
                  );
                  const maxSignalSizeSpans = findElements(
                    basASRInfoContainer,
                    '.bas-asr-info-max-signal-size-megabytes'
                  );
                  const quotaPerMonthSpans = findElements(
                    basASRInfoContainer,
                    '.bas-asr-info-quota-per-month-seconds'
                  );
                  const termsURLSpans = findElements(
                    basASRInfoContainer,
                    '.bas-asr-info-eula-link'
                  );
                  const dataStoragePolicySpans = findElements(
                    basASRInfoContainer,
                    '.bas-asr-info-data-storage-policy'
                  );
                  const knownIssuesSpans = findElements(
                    basASRInfoContainer,
                    '.bas-asr-info-known-issues'
                  );

                  const newElem: any = {
                    name: getAttr(
                      basASRInfoContainer,
                      'data-bas-asr-info-provider-name'
                    ),
                    maxSignalDuration:
                      maxSignalDurationSpans.length > 0
                        ? getAttr(maxSignalDurationSpans[0], 'data-value')
                        : undefined,
                    maxSignalSize:
                      maxSignalSizeSpans.length > 0
                        ? getAttr(maxSignalSizeSpans[0], 'data-value')
                        : undefined,
                    quotaPerMonth:
                      quotaPerMonthSpans.length > 0
                        ? getAttr(quotaPerMonthSpans[0], 'data-value')
                        : undefined,
                    termsURL:
                      termsURLSpans.length > 0
                        ? getAttr(termsURLSpans[0], 'href')
                        : undefined,
                    dataStoragePolicy:
                      dataStoragePolicySpans.length > 0
                        ? dataStoragePolicySpans[0].innerText
                        : undefined,
                    knownIssues:
                      knownIssuesSpans.length > 0
                        ? knownIssuesSpans[0].innerText
                        : undefined,
                  };

                  sanitizeNumberValue(newElem, 'maxSignalDuration');
                  sanitizeNumberValue(newElem, 'maxSignalSize');
                  sanitizeNumberValue(newElem, 'quotaPerMonth');
                  sanitizeStringValue(newElem, 'dataStoragePolicy');
                  sanitizeStringValue(newElem, 'knownIssues');
                  newElem.knownIssues =
                    newElem.knownIssues.trim() === 'none'
                      ? undefined
                      : newElem.knownIssues;

                  asrInfos.push(newElem);
                }

                // overwrite data of config
                for (const service of settings.octra.plugins.asr.services) {
                  if (service.basName !== undefined) {
                    const basInfo = asrInfos.find(
                      (a) => a.name === service.basName
                    );
                    if (basInfo !== undefined) {
                      service.dataStoragePolicy =
                        basInfo.dataStoragePolicy !== undefined
                          ? basInfo.dataStoragePolicy
                          : service.dataStoragePolicy;

                      service.maxSignalDuration =
                        basInfo.maxSignalDuration !== undefined
                          ? basInfo.maxSignalDuration
                          : service.maxSignalDuration;

                      service.maxSignalSize =
                        basInfo.maxSignalSize !== undefined
                          ? basInfo.maxSignalSize
                          : service.maxSignalSize;

                      service.knownIssues =
                        basInfo.knownIssues !== undefined
                          ? basInfo.knownIssues
                          : service.knownIssues;

                      service.quotaPerMonth =
                        basInfo.quotaPerMonth !== undefined
                          ? basInfo.quotaPerMonth
                          : service.quotaPerMonth;

                      service.termsURL =
                        basInfo.termsURL !== undefined
                          ? basInfo.termsURL
                          : service.termsURL;
                    }
                  }
                }

                return ApplicationActions.loadASRSettings.success({
                  settings,
                });
              })
            );
        } else {
          return of(
            ApplicationActions.loadASRSettings.fail({
              error: undefined as any,
            })
          );
        }
      })
    )
  );

  settingsLoaded$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApplicationActions.loadSettings.success),
      exhaustMap((a) => {
        // set language
        const language = this.localStorage.retrieve('language');
        this.transloco.setAvailableLangs(a.settings.octra.languages);

        this.transloco.setActiveLang(
          language?.replace(/-.*/g, '') ?? getBrowserLang() ?? 'en'
        );

        const webToken = this.sessStr.retrieve('webToken');
        const authType = this.sessStr.retrieve('authType');
        const authenticated = this.sessStr.retrieve('loggedIn');

        this.transloco.setAvailableLangs(a.settings.octra.languages);

        return of(
          APIActions.init.do({
            url: a.settings.api.url,
            appToken: a.settings.api.appToken,
            authType,
            authenticated,
            webToken,
          })
        );
      })
    )
  );

  afterAPIInit$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(APIActions.init.success),
        withLatestFrom(this.store),
        tap(([a, state]) => {
          if (
            state.application.appConfiguration?.octra?.tracking?.active &&
            state.application.appConfiguration.octra.tracking.active !== ''
          ) {
            this.appendTrackingCode(
              state.application.appConfiguration.octra.tracking.active,
              state.application.appConfiguration
            );
          }
          this.store.dispatch(
            ApplicationActions.initApplication.setSessionStorageOptions({
              playOnHover: this.sessStr.retrieve('playonhover') ?? false,
              followPlayCursor:
                this.sessStr.retrieve('followplaycursor') ?? false,
              loggedIn:
                this.sessStr.retrieve('loggedIn') ?? a.authenticated ?? false,
              reloaded: this.sessStr.retrieve('reloaded') ?? false,
            })
          );
        })
      ),
    { dispatch: false }
  );

  afterInitApplication$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ApplicationActions.initApplication.finish),
        withLatestFrom(this.store),
        tap(([a, state]) => {
          if (!state.application.mode) {
            // no mode active
            if (state.authentication.authenticated) {
              this.store.dispatch(
                AuthenticationActions.logout.do({
                  message: 'logout due undefined mode',
                  messageType: 'error',
                  mode: undefined,
                  clearSession: false,
                })
              );
            } else {
              this.store.dispatch(ApplicationActions.redirectToLastPage.do());
            }
            return;
          }

          if (!state.application.loggedIn) {
            this.routerService.navigate(
              'not logged in, back to login',
              ['/login'],
              AppInfo.queryParamsHandling
            );
          } else {
            // logged in
            console.log(`LOGGED IN! with mode ${state.application.mode}`);
            const modeState = getModeState(state)!;
            const t = JSON.parse(JSON.stringify(modeState));
            this.store.dispatch(
              AnnotationActions.prepareTaskDataForAnnotation.do({
                currentProject:
                  getModeState(state)!.currentSession.currentProject!,
                mode: state.application.mode,
                task: getModeState(state)!.currentSession!.task!,
              })
            );
          }
        })
      ),
    { dispatch: false }
  );

  redirectToLastPage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ApplicationActions.redirectToLastPage.do),
        tap((a) => {
          const lastPagePath = this.sessStr.retrieve('last_page_path');
          if (lastPagePath) {
            this.routerService.navigate('last page', [lastPagePath]);
          } else {
            this.routerService.navigate('no last page', ['/login']);
          }
        })
      ),
    { dispatch: false }
  );

  afterIDBLoaded$ = createEffect(() =>
    this.actions$.pipe(
      ofType(IDBActions.loadConsoleEntries.success),
      withLatestFrom(this.store),
      exhaustMap(([a, state]: [Action, RootState]) => {
        this.bugService.addEntriesFromDB(this.appStorage.consoleEntries);

        if (
          state.asr.settings?.selectedService &&
          state.asr.settings?.selectedLanguage
        ) {
          const selectedLanguage = state.asr.settings.selectedLanguage;
          const selectedService = state.asr.settings.selectedService;

          /* TODO Implement
                        const lang: ASRLanguage | undefined =
                          this.asrService.getLanguageByCode(
                            selectedLanguage,
                            selectedService
                          );

                        if (lang) {
                          // TODO implement this.asrService.se = lang;
                        } else {
                          console.error('Could not read ASR language from database');
                        }

                         */
        }

        if (!this.settingsService.responsive.enabled) {
          this.setFixedWidth();
        }

        const queryParams = {
          audio: this.getParameterByName('audio'),
          host: this.getParameterByName('host'),
          transcript: this.getParameterByName('transcript'),
          embedded: this.getParameterByName('embedded'),
        };

        const transcriptURL =
          queryParams.transcript !== undefined
            ? queryParams.transcript
            : undefined;
        // define languages
        const languages = state.application.appConfiguration!.octra.languages;
        const browserLang =
          navigator.language || (navigator as any).userLanguage;

        // check if browser language is available in translations
        if (
          this.appStorage.language === undefined ||
          this.appStorage.language === ''
        ) {
          if (
            state.application.appConfiguration!.octra.languages.find(
              (value) => {
                return value === browserLang;
              }
            ) !== undefined
          ) {
            this.transloco.setActiveLang(browserLang);
          } else {
            // use first language defined as default language
            this.transloco.setActiveLang(languages[0]);
          }
        } else {
          if (
            state.application.appConfiguration!.octra.languages.find(
              (value) => {
                return value === this.appStorage.language;
              }
            ) !== undefined
          ) {
            this.transloco.setActiveLang(this.appStorage.language);
          } else {
            this.transloco.setActiveLang(languages[0]);
          }
        }

        // if url mode, set it in options
        if (this.queryParamsSet(queryParams)) {
          this.appStorage.setURLSession(
            queryParams.audio!,
            transcriptURL!,
            queryParams.embedded === '1',
            queryParams.host!
          );
        }

        return of(ApplicationActions.initApplication.finish());
      })
    )
  );

  loadLanguage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApplicationActions.loadLanguage.do),
      exhaustMap((a) => {
        this.transloco.setAvailableLangs(['en']);
        this.transloco.setActiveLang('en');
        return of(ApplicationActions.loadLanguage.success());
      })
    )
  );

  loadLanguageSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApplicationActions.loadLanguage.success),
      exhaustMap((a) => {
        return of(ApplicationActions.loadSettings.do());
      })
    )
  );

  logoutSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthenticationActions.logout.success),
      exhaustMap((action) => {
        this.sessStr.clear();
        // clear undo history
        this.store.dispatch(ApplicationActions.clear());

        const subject = new Subject<Action>();

        timer(10).subscribe(() => {
          if (action.type === AuthenticationActions.logout.success.type) {
            subject.next(LoginModeActions.clearSessionStorage.success());
          } else {
            subject.next(LoginModeActions.clearSessionStorage.success());
          }
          subject.complete();

          this.routerService
            .navigate(
              'after logout success',
              ['/login'],
              AppInfo.queryParamsHandling
            )
            .catch((error) => {
              console.error(error);
            });
        });

        return subject;
      })
    )
  );

  wait$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ApplicationActions.waitForEffects.do),
        tap((a) => {
          this.routerService.navigate(
            'wait for effects',
            ['/load'],
            AppInfo.queryParamsHandling
          );
        })
      ),
    { dispatch: false }
  );

  showErrorMessage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          AnnotationActions.startAnnotation.fail,
          ApplicationActions.showErrorModal.do
        ),
        tap((a) => {
          const ref = this.modalService.openModalRef<ErrorModalComponent>(
            ErrorModalComponent,
            {
              ...ErrorModalComponent.options,
              backdrop: a.showOKButton ? true : 'static',
            },
            {
              text: a.error,
              showOKButton: a.showOKButton,
            }
          );
        })
      ),
    { dispatch: false }
  );

  logActionsToConsole$ = createEffect(
    () =>
      this.actions$.pipe(
        tap((action) => {
          if (
            environment.debugging.enabled &&
            environment.debugging.logging.actions
          ) {
            console.groupCollapsed(`--- ACTION ${action.type} ---`);
            console.log(JSON.stringify(action, null, 2));
            console.groupEnd();
          }
        })
      ),
    {
      dispatch: false,
    }
  );

  appLoadingFail$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ApplicationActions.loadSettings.fail),
        tap((a) => {
          const ref = this.modalService.openModalRef<ErrorModalComponent>(
            ErrorModalComponent,
            {
              ...ErrorModalComponent.options,
              backdrop: 'static',
            },
            {
              text: `Can't load application settings: ${a.error}`,
            }
          );

          ref.componentInstance.showOKButton = false;
        })
      ),
    { dispatch: false }
  );

  constructor(
    private actions$: Actions,
    private transloco: TranslocoService,
    private sessStr: SessionStorageService,
    private localStorage: LocalStorageService,
    private store: Store<RootState>,
    private http: HttpClient,
    private configurationService: ConfigurationService,
    private bugService: BugReportService,
    private appStorage: AppStorageService,
    private settingsService: SettingsService,
    private routerService: RoutingService,
    private modalService: OctraModalService
  ) {}

  private initConsoleLogging() {
    // overwrite console.log
    if (environment.debugging.logging.console) {
      console.log('ACTIVATED');
      const oldLog = console.log;
      const serv = this.bugService;
      (() => {
        // tslint:disable-next-line:only-arrow-functions
        console.log = function (...args) {
          serv.addEntry(ConsoleType.LOG, args[0]);
          // eslint-disable-next-line prefer-rest-params
          oldLog.apply(console, args);
        };
      })();

      // overwrite console.err
      const oldError = console.error;
      (() => {
        // tslint:disable-next-line:only-arrow-functions
        console.error = function (...args) {
          const error = args[0];
          const context = args[1];

          let debug = '';
          let stack: string | undefined = '';

          if (typeof error === 'string') {
            debug = error;

            if (
              error === 'ERROR' &&
              context !== undefined &&
              context.stack &&
              context.message
            ) {
              debug = context.message;
              stack = context.stack;
            }
          } else {
            if (error instanceof Error) {
              debug = error.message;
              stack = error.stack;
            } else {
              if (typeof error === 'object') {
                // some other type of object
                debug = 'OBJECT';
                stack = JSON.stringify(error);
              } else {
                debug = error;
              }
            }
          }

          if (debug !== '') {
            serv.addEntry(
              ConsoleType.ERROR,
              `${debug}${stack !== '' ? ' ' + stack : ''}`
            );
          }

          // eslint-disable-next-line prefer-rest-params
          oldError.apply(console, args);
        };
      })();

      // overwrite console.warn
      const oldWarn = console.warn;
      (() => {
        // tslint:disable-next-line:only-arrow-functions
        console.warn = function (...args) {
          serv.addEntry(ConsoleType.WARN, args[0]);
          // eslint-disable-next-line prefer-rest-params
          oldWarn.apply(console, args);
        };
      })();
    }
  }

  private appendTrackingCode(type: string, settings: AppSettings) {
    // check if matomo is activated
    if (type === 'matomo') {
      if (
        settings.octra.tracking.matomo !== undefined &&
        settings.octra.tracking.matomo.host !== undefined &&
        settings.octra.tracking.matomo.siteID !== undefined
      ) {
        const matomoSettings = settings.octra.tracking.matomo;

        const trackingCode = document.createElement('script');
        trackingCode.setAttribute('type', 'text/javascript');
        trackingCode.innerHTML = `
<!-- Matomo -->
<script type="text/javascript">
  var _paq = window._paq || [];
  /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {
    var u="${matomoSettings.host}";
    _paq.push(['setTrackerUrl', u+'piwik.php']);
    _paq.push(['setSiteId', '${matomoSettings.siteID}']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.type='text/javascript'; g.async=true; g.defer=true; g.src=u+'piwik.js'; s.parentNode.insertBefore(g,s);
  })();
</script>
<!-- End Matomo Code -->`;

        document.body.appendChild(trackingCode);
      } else {
        console.error(
          `attributes for piwik tracking in appconfig.json are invalid.`
        );
      }
    } else {
      console.error(`tracking type ${type} is not supported.`);
    }
  }

  private setFixedWidth() {
    // set fixed width
    const head = document.head || document.getElementsByTagName('head')[0];
    const style = document.createElement('style');
    style.type = 'text/css';
    style.innerText =
      '.container {width:' + this.settingsService.responsive.fixedwidth + 'px}';
    head.appendChild(style);
  }

  private getParameterByName(name: string, url?: string) {
    if (!url) {
      url = document.location.href;
    }
    name = name.replace(/[[]]/g, '\\$&');
    const regExp = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regExp.exec(url);
    if (!results) {
      return undefined;
    }
    if (!results[2]) {
      return '';
    }
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  private queryParamsSet(queryParams: Params): boolean {
    return (
      queryParams['audio'] !== undefined &&
      queryParams['embedded'] !== undefined
    );
  }
}
