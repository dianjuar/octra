import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { Action, Store } from "@ngrx/store";
import { LocalStorageService, SessionStorageService } from "ngx-webstorage";
import { ApplicationActions } from "../application/application.actions";
import { OnlineModeActions } from "../modes/online-mode/online-mode.actions";
import { LocalModeActions } from "../modes/local-mode/local-mode.actions";
import { catchError, forkJoin, map, of, Subject, tap, timer } from "rxjs";
import { exhaustMap } from "rxjs/operators";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { APIActions } from "../api";
import { getBrowserLang, TranslocoService } from "@ngneat/transloco";
import { uniqueHTTPRequest } from "@octra/ngx-utilities";
import { ConfigurationService } from "../../shared/service/configuration.service";
import { findElements, getAttr } from "@octra/utilities";
import { AppConfigSchema } from "../../schemata/appconfig.schema";


@Injectable({
  providedIn: "root"
})
export class ApplicationEffects {
  initApp$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ApplicationActions.initApplication.do),
        tap(() => {
          this.store.dispatch(ApplicationActions.loadLanguage.do());
          this.store.dispatch(ApplicationActions.loadSettings.do());
        })
      ),
    { dispatch: false }
  );

  loadSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApplicationActions.loadSettings.do),
      exhaustMap((a) => {
        return forkJoin(
          [
            uniqueHTTPRequest(this.http, false, {
              responseType: "json"
            }, "config/appconfig.json", undefined)
          ]).pipe(
          map(([appconfig]) => {
            const validation = this.configurationService.validateJSON(appconfig, AppConfigSchema);

            if (validation.length === 0) {
              return ApplicationActions.loadSettings.success({
                settings: appconfig
              });
            } else {
              return ApplicationActions.loadSettings.fail({
                error: new HttpErrorResponse({
                  error: new Error("Appconfig is invalid.")
                })
              });
            }
            return ApplicationActions.changeLanguage.success();
          }),
          catchError((err: HttpErrorResponse) => {
            return of(ApplicationActions.loadSettings.fail({
              error: err
            }));
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
        if (settings.octra.plugins.asr.asrInfoURL !== undefined
          && typeof settings.octra.plugins.asr.asrInfoURL === "string"
          && settings.octra.plugins.asr.asrInfoURL
        ) {
          return this.http.get(
            settings.octra.plugins.asr.asrInfoURL,
            { responseType: "text" }
          ).pipe(
            map((result) => {
              const document = (new DOMParser()).parseFromString(result, "text/html");
              const basTable = document.getElementById("#bas-asr-service-table");
              const basASRInfoContainers = findElements(basTable, ".bas-asr-info-container");

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
                  if (el[attr] !== undefined && typeof el[attr] === "string") {
                    el[attr] = el[attr].replace(/[\n\t\r]+/g, "");
                  } else {
                    el[attr] = undefined;
                  }
                };

                const maxSignalDurationSpans = findElements(basASRInfoContainer, ".bas-asr-info-max-signal-duration-seconds");
                const maxSignalSizeSpans = findElements(basASRInfoContainer, ".bas-asr-info-max-signal-size-megabytes");
                const quotaPerMonthSpans = findElements(basASRInfoContainer, ".bas-asr-info-quota-per-month-seconds");
                const termsURLSpans = findElements(basASRInfoContainer, ".bas-asr-info-eula-link");
                const dataStoragePolicySpans = findElements(basASRInfoContainer, ".bas-asr-info-data-storage-policy");
                const knownIssuesSpans = findElements(basASRInfoContainer, ".bas-asr-info-known-issues");


                const newElem: any = {
                  name: getAttr(basASRInfoContainer, "data-bas-asr-info-provider-name"),
                  maxSignalDuration: (maxSignalDurationSpans.length > 0) ? getAttr(maxSignalDurationSpans[0], "data-value") : undefined,
                  maxSignalSize: (maxSignalSizeSpans.length > 0) ? getAttr(maxSignalSizeSpans[0], "data-value") : undefined,
                  quotaPerMonth: (quotaPerMonthSpans.length > 0) ? getAttr(quotaPerMonthSpans[0], "data-value") : undefined,
                  termsURL: (termsURLSpans.length > 0) ? getAttr(termsURLSpans[0], "href") : undefined,
                  dataStoragePolicy: (dataStoragePolicySpans.length > 0) ? dataStoragePolicySpans[0].innerText : undefined,
                  knownIssues: (knownIssuesSpans.length > 0) ? knownIssuesSpans[0].innerText : undefined
                };

                sanitizeNumberValue(newElem, "maxSignalDuration");
                sanitizeNumberValue(newElem, "maxSignalSize");
                sanitizeNumberValue(newElem, "quotaPerMonth");
                sanitizeStringValue(newElem, "dataStoragePolicy");
                sanitizeStringValue(newElem, "knownIssues");
                newElem.knownIssues = (newElem.knownIssues.trim() === "none") ? undefined : newElem.knownIssues;

                asrInfos.push(newElem);
              }

              // overwrite data of config
              for (const service of settings.octra.plugins.asr.services) {
                if (service.basName !== undefined) {
                  const basInfo = asrInfos.find(a => a.name === service.basName);
                  if (basInfo !== undefined) {
                    service.dataStoragePolicy = (basInfo.dataStoragePolicy !== undefined)
                      ? basInfo.dataStoragePolicy : service.dataStoragePolicy;

                    service.maxSignalDuration = (basInfo.maxSignalDuration !== undefined)
                      ? basInfo.maxSignalDuration : service.maxSignalDuration;

                    service.maxSignalSize = (basInfo.maxSignalSize !== undefined)
                      ? basInfo.maxSignalSize : service.maxSignalSize;

                    service.knownIssues = (basInfo.knownIssues !== undefined)
                      ? basInfo.knownIssues : service.knownIssues;

                    service.quotaPerMonth = (basInfo.quotaPerMonth !== undefined)
                      ? basInfo.quotaPerMonth : service.quotaPerMonth;

                    service.termsURL = (basInfo.termsURL !== undefined)
                      ? basInfo.termsURL : service.termsURL;
                  }
                }
              }

              return ApplicationActions.loadASRSettings.success({
                settings
              });
            })
          );
        } else {
          return of(ApplicationActions.loadASRSettings.fail({
            error: undefined
          }));
        }
      })
    )
  );

  settingsLoaded$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApplicationActions.loadSettings.success),
      exhaustMap((a) => {
        const webToken = this.sessStr.retrieve("webToken");
        const authType = this.sessStr.retrieve("authType");
        const authenticated = this.sessStr.retrieve("authenticated");

        this.store.dispatch(
          APIActions.init.do({
            url: a.settings.api.url,
            appToken: a.settings.api.appToken,
            authType,
            authenticated,
            webToken
          })
        );
        return of(ApplicationActions.initApplication.success());
      })
    )
  );

  loadLanguage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApplicationActions.loadLanguage.do),
      exhaustMap((a) => {
        const language = this.localStorage.retrieve("language");
        this.transloco.setActiveLang(language?.replace(/-.*/g, "") ?? getBrowserLang() ?? "en");
        return of(ApplicationActions.loadLanguage.success());
      })
    )
  );

  logoutSession$ = createEffect(() => this.actions$.pipe(
    ofType(OnlineModeActions.logout, LocalModeActions.logout),
    exhaustMap((action) => {
      this.sessStr.clear();
      // clear undo history
      this.store.dispatch(ApplicationActions.clear());

      const subject = new Subject<Action>();

      timer(10).subscribe(() => {
        if (action.type === OnlineModeActions.logout.type) {
          subject.next(OnlineModeActions.clearSessionStorageSuccess());
        } else {
          subject.next(LocalModeActions.clearSessionStorageSuccess());
        }
        subject.complete();
      });

      return subject;
    })
  ));

  constructor(private actions$: Actions,
              private transloco: TranslocoService,
              private sessStr: SessionStorageService,
              private localStorage: LocalStorageService,
              private store: Store,
              private http: HttpClient,
              private configurationService: ConfigurationService) {
  }
}
