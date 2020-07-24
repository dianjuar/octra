import {HttpClient} from '@angular/common/http';
import {Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslocoService} from '@ngneat/transloco';
import {AppInfo} from '../../../app.info';
import {Functions, isUnset, SubscriptionManager} from '@octra/utilities';
import {AudioService, SettingsService, TranscriptionService} from '../../shared/service';
import {AppStorageService, OIDBLevel} from '../../shared/service/appstorage.service';
import {IFile, ImportResult, OAudiofile, OLevel} from '@octra/annotation';

@Component({
  selector: 'octra-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.css']
})
export class LoadingComponent implements OnInit, OnDestroy {
  @Output() loaded: boolean;
  public text = '';
  public progress = 0;
  public audioLoadingProgress = 0;
  public state = '';
  public warning = '';
  private subscrmanager: SubscriptionManager = new SubscriptionManager();
  private loadedchanged: EventEmitter<boolean> = new EventEmitter<boolean>();
  private loadedtable: any = {
    projectconfig: false,
    guidelines: false,
    methods: false,
    audio: false
  };

  constructor(private langService: TranslocoService,
              public settService: SettingsService,
              public appStorage: AppStorageService,
              public audio: AudioService,
              private router: Router,
              private transcrService: TranscriptionService,
              private http: HttpClient,
              private route: ActivatedRoute) {
  }

  ngOnInit() {
    new Promise<void>((resolve, reject) => {
      if (this.settService.isDBLoadded) {
        resolve();
      } else {
        this.subscrmanager.add(this.settService.dbloaded.subscribe(
          () => {
            resolve();
          }));
      }
    }).then(() => {
      this.langService.selectTranslate('general.please wait').subscribe(
        (translation) => {
          this.text = translation + '... ';
        }
      );
    }).catch((error) => {
    });

    this.subscrmanager.add(
      this.settService.projectsettingsloaded.subscribe(
        (projectsettings) => {
          this.loadedtable.projectconfig = true;
          this.progress += 25;
          this.state = 'Project configuration loaded';
          let language = this.langService.getActiveLang();

          const found = projectsettings.languages.find((x) => {
            return x === language;
          });
          if ((found === null || found === undefined)) {
            // fall back to first defined language
            language = projectsettings.languages[0];
          }
          this.settService.loadGuidelines(this.appStorage.language, './config/localmode/guidelines/guidelines_' + language + '.json');

          this.loadedchanged.emit(false);
        }
      )
    );

    this.subscrmanager.add(
      this.settService.guidelinesloaded.subscribe(
        () => {
          this.loadedtable.guidelines = true;
          this.progress += 25;
          this.state = 'Guidelines loaded';
          this.loadedchanged.emit(false);
        }
      )
    );

    this.subscrmanager.add(
      this.settService.validationmethodloaded.subscribe(
        () => {
          this.loadedtable.methods = true;
          this.progress += 25;
          this.state = 'Methods loaded';
          if (!this.loadedtable.audio) {
            this.state = 'Load Audio...';
          }
          this.loadedchanged.emit(false);
        }
      )
    );

    this.subscrmanager.add(
      this.settService.audioloaded.subscribe(
        (result) => {
          if (result.status === 'success') {
            new Promise<void>((resolve, reject) => {
              if (this.appStorage.usemode === 'url' && this.appStorage.urlParams.transcript !== null) {
                this.transcrService.defaultFontSize = 16;

                // load transcript file via URL
                this.http.get(this.appStorage.urlParams.transcript, {
                  responseType: 'text'
                }).subscribe(
                  (res) => {

                    this.state = 'Import transcript...';
                    let filename = this.appStorage.urlParams.transcript;
                    filename = filename.substr(filename.lastIndexOf('/') + 1);

                    const file: IFile = {
                      name: filename,
                      content: res,
                      type: 'text',
                      encoding: 'utf-8'
                    };

                    // convert par to annotJSON
                    const audioRessource = this.audio.audiomanagers[0].ressource;
                    const oAudioFile = new OAudiofile();
                    oAudioFile.arraybuffer = audioRessource.arraybuffer;
                    oAudioFile.duration = audioRessource.info.duration.samples;
                    oAudioFile.name = audioRessource.info.fullname;
                    oAudioFile.sampleRate = audioRessource.info.duration.sampleRate;
                    oAudioFile.size = audioRessource.size;

                    let importResult: ImportResult;
                    // find valid converter...
                    for (const converter of AppInfo.converters) {
                      if (filename.indexOf(converter.extension) > -1) {
                        // test converter
                        const tempImportResult = converter.import(file, oAudioFile);

                        if (!isUnset(tempImportResult) && tempImportResult.error === '') {
                          importResult = tempImportResult;
                          break;
                        } else {
                          console.error(tempImportResult.error);
                        }
                      }
                    }

                    if (!(importResult === null || importResult === undefined)
                      && !(importResult.annotjson === null || importResult.annotjson === undefined)) {
                      // conversion successfully finished
                      const newLevels: OIDBLevel[] = [];
                      for (let i = 0; i < importResult.annotjson.levels.length; i++) {
                        newLevels.push(new OIDBLevel(i + 1, importResult.annotjson.levels[i], i));
                      }

                      this.appStorage.overwriteAnnotation(newLevels, false).then(
                        () => {
                          resolve();
                        }
                      ).catch((error) => {
                        reject(error);
                      });
                    } else {
                      this.settService.log = 'Invalid transcript file';
                      reject('importResult is empty');
                    }
                  },
                  (err) => {
                    reject(err);
                  }
                );
              } else {
                if (this.appStorage.usemode === 'url') {
                  // overwrite
                  this.transcrService.defaultFontSize = 16;

                  const newLevels: OIDBLevel[] = [];
                  newLevels.push(new OIDBLevel(1, new OLevel('OCTRA_1', 'SEGMENT'), 1));

                  this.appStorage.overwriteAnnotation(newLevels, false).then(
                    () => {
                      resolve();
                    }
                  ).catch((error) => {
                    reject(error);
                  });
                } else {
                  resolve();
                }
              }
            }).then(() => {
              this.loadedtable.audio = true;
              this.state = 'Audio loaded';

              this.loadedchanged.emit(false);
            }).catch((error) => {
              console.error(error);
            });
          } else {
            console.error('audio not loaded');
            if (this.appStorage.usemode === 'local') {
              Functions.navigateTo(this.router, ['/user/transcr/reload-file'], AppInfo.queryParamsHandling).catch((error) => {
                console.error(error);
              });
            }
          }
        }
      )
    );

    const id = this.subscrmanager.add(
      this.loadedchanged.subscribe(
        () => {
          if (
            this.loadedtable.guidelines
            && this.loadedtable.projectconfig
            && this.loadedtable.methods
            && this.loadedtable.audio
          ) {
            this.subscrmanager.removeById(id);
            setTimeout(() => {
              if (((this.appStorage.agreement === null || this.appStorage.agreement === undefined)
                  || (this.appStorage.agreement[this.appStorage.user.project] === null
                  || this.appStorage.agreement[this.appStorage.user.project] === undefined) ||
                  !this.appStorage.agreement[this.appStorage.user.project]
                )
                && this.settService.projectsettings.agreement.enabled && this.appStorage.usemode === 'online') {
                this.transcrService.load().then(() => {
                  Functions.navigateTo(this.router, ['/user/agreement'], AppInfo.queryParamsHandling).catch((error) => {
                    console.error(error);
                  });
                }).catch((err) => {
                  console.error(err);
                });
              } else {
                this.transcrService.load().then(() => {
                  Functions.navigateTo(this.router, ['/user/transcr'], AppInfo.queryParamsHandling).catch((error) => {
                    console.error(error);
                  });
                }).catch((err) => {
                  console.error(err);
                });
              }
            }, 500);
          }
        }
      )
    );

    new Promise<void>((resolve, reject) => {
      if (!this.appStorage.idbloaded) {
        this.subscrmanager.add(this.appStorage.loaded.subscribe(() => {
          },
          (error) => {
            reject(error);
          },
          () => {
            resolve();
          }));
      } else {
        resolve();
      }
    }).then(() => {

      if (this.appStorage.urlParams.hasOwnProperty('audio') && this.appStorage.urlParams.audio !== ''
        && !(this.appStorage.urlParams.audio === null || this.appStorage.urlParams.audio === undefined)) {
        this.appStorage.usemode = 'url';
        this.appStorage.LoggedIn = true;
      } else if (this.appStorage.usemode === 'url') {
        // url mode set, but no params => change mode
        console.warn(`use mode is url but no params found. Reset use mode.`);
        this.appStorage.usemode = (!isUnset(this.appStorage.user) && !isUnset(this.appStorage.user.id) && this.appStorage.user.id !== ''
          && ((this.appStorage.sessionfile === null || this.appStorage.sessionfile === undefined)))
          ? 'online' : 'local';
        this.appStorage.LoggedIn = false;
      }

      if (this.appStorage.usemode !== 'url' && !this.appStorage.LoggedIn) {
        // not logged in, go back
        Functions.navigateTo(this.router, ['/login'], AppInfo.queryParamsHandling).catch((error) => {
          console.error(error);
        });
      } else if (this.appStorage.LoggedIn) {
        this.settService.loadProjectSettings().catch((error) => {
          console.error(error);
        });

        if (this.appStorage.usemode === 'local' && this.audio.audiomanagers.length === 0) {
          Functions.navigateTo(this.router, ['/user/transcr/reload-file'], AppInfo.queryParamsHandling).catch((error) => {
            console.error(error);
          });
        } else {
          if (this.appStorage.usemode === 'url') {
            if (this.appStorage.usemode === 'url') {
              this.state = 'Get transcript from URL...';
              // set audio url from url params
              this.appStorage.audioURL = decodeURI(this.appStorage.urlParams.audio);
            }
          }

          console.log(`mode is ${this.appStorage.usemode} and audioSrc is ${this.appStorage.audioURL}`);

          this.settService.audioloading.subscribe(
            (progress) => {
              this.audioLoadingProgress = progress * 25;
            }
          );

          this.settService.loadAudioFile(this.audio);
        }
      } else {
        console.warn(`special situation: loggedIn is null! usemode ${this.appStorage.usemode} url: ${this.appStorage.audioURL}`);
      }
    }).catch((error) => {
      console.error(error);
    });
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  retry() {
    location.reload();
  }

  goBack() {
    this.appStorage.clearSession();
    Functions.navigateTo(this.router, ['/login'], AppInfo.queryParamsHandling).catch((error) => {
      console.error(error);
    });
  }
}