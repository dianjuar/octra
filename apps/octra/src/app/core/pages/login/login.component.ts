import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {NgForm} from '@angular/forms';
import {Router} from '@angular/router';
import {TranslocoService} from '@ngneat/transloco';
import {sha256} from 'js-sha256';
import {FileSize, Functions, isUnset, SubscriptionManager} from '@octra/utilities';
import {Observable, throwError} from 'rxjs';
import {AppInfo} from '../../../app.info';
import {ModalService} from '../../modals/modal.service';
import {ModalDeleteAnswer} from '../../modals/transcription-delete-modal/transcription-delete-modal.component';
import {parseServerDataEntry} from '../../obj/data-entry';
import {SessionFile} from '../../obj/SessionFile';
import {APIService, AudioService, SettingsService} from '../../shared/service';
import {AppStorageService, OIDBLevel, OIDBLink} from '../../shared/service/appstorage.service';
import {OctraDropzoneComponent} from '../../component/octra-dropzone/octra-dropzone.component';
import {ComponentCanDeactivate} from './login.deactivateguard';
import {LoginService} from './login.service';
import {Converter} from '@octra/annotation';

@Component({
  selector: 'octra-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  providers: [LoginService]
})
export class LoginComponent implements OnInit, OnDestroy, ComponentCanDeactivate, AfterViewInit {

  @ViewChild('f', {static: false}) loginform: NgForm;
  @ViewChild('dropzone', {static: true}) dropzone: OctraDropzoneComponent;
  @ViewChild('agreement', {static: false}) agreement: ElementRef;
  @ViewChild('localmode', {static: true}) localmode: ElementRef;
  @ViewChild('onlinemode', {static: true}) onlinemode: ElementRef;
  public validSize = false;
  public agreementChecked = true;
  public projects: string[] = [];
  valid = false;
  member = {
    id: '',
    agreement: '',
    project: '',
    jobno: '',
    password: ''
  };
  err = '';
  public apiStatus: 'init' | 'available' | 'unavailable' = 'init';
  private subscrmanager: SubscriptionManager;

  get sessionfile(): SessionFile {
    return this.appStorage.sessionfile;
  }

  get apc(): any {
    return this.settingsService.appSettings;
  }

  public get Math(): Math {
    return Math;
  }

  constructor(private router: Router,
              public appStorage: AppStorageService,
              private api: APIService,
              private cd: ChangeDetectorRef,
              private settingsService: SettingsService,
              public modService: ModalService,
              private langService: TranslocoService,
              private audioService: AudioService) {
    this.subscrmanager = new SubscriptionManager();
  }

  onOfflineSubmit = () => {
    if (this.appStorage.usemode !== 'demo' && !isUnset(this.appStorage.dataID) && typeof this.appStorage.dataID === 'number') {
      // last was online mode
      this.api.setOnlineSessionToFree(this.appStorage).then(() => {
        this.audioService.registerAudioManager(this.dropzone.audioManager);
        this.appStorage.beginLocalSession(this.dropzone.files, false, () => {
          if (!(this.dropzone.oannotation === null || this.dropzone.oannotation === undefined)) {
            const newLevels: OIDBLevel[] = [];
            for (let i = 0; i < this.dropzone.oannotation.levels.length; i++) {
              newLevels.push(new OIDBLevel(i + 1, this.dropzone.oannotation.levels[i], i));
            }

            const newLinks: OIDBLink[] = [];
            for (let i = 0; i < this.dropzone.oannotation.links.length; i++) {
              newLinks.push(new OIDBLink(i + 1, this.dropzone.oannotation.links[i]));
            }

            this.appStorage.overwriteAnnotation(newLevels).then(
              () => {
                return this.appStorage.overwriteLinks(newLinks);
              }
            ).then(() => {
              this.navigate();
            }).catch((err) => {
              console.error(err);
            });
          } else {
            this.navigate();
          }
        }, (error) => {
          alert(error);
        });
      }).catch((error) => {
        console.error(error);
      });
    } else {
      this.audioService.registerAudioManager(this.dropzone.audioManager);
      this.appStorage.beginLocalSession(this.dropzone.files, true, () => {
        if (!(this.dropzone.oannotation === null || this.dropzone.oannotation === undefined)) {
          const newLevels: OIDBLevel[] = [];
          for (let i = 0; i < this.dropzone.oannotation.levels.length; i++) {
            newLevels.push(new OIDBLevel(i + 1, this.dropzone.oannotation.levels[i], i));
          }

          const newLinks: OIDBLink[] = [];
          for (let i = 0; i < this.dropzone.oannotation.links.length; i++) {
            newLinks.push(new OIDBLink(i + 1, this.dropzone.oannotation.links[i]));
          }

          this.appStorage.overwriteAnnotation(newLevels).then(() => {
            return this.appStorage.overwriteLinks(newLinks);
          }).then(() => {
            this.navigate();
          }).catch((err) => {
            console.error(err);
          });
        } else {
          this.navigate();
        }
      }, (error) => {
        alert(error);
      });
    }
  }
  newTranscription = () => {
    this.audioService.registerAudioManager(this.dropzone.audioManager);

    this.appStorage.beginLocalSession(this.dropzone.files, false, () => {
        if (!(this.dropzone.oannotation === null || this.dropzone.oannotation === undefined)) {
          const newLevels: OIDBLevel[] = [];
          for (let i = 0; i < this.dropzone.oannotation.levels.length; i++) {
            newLevels.push(new OIDBLevel(i + 1, this.dropzone.oannotation.levels[i], i));
          }

          const newLinks: OIDBLink[] = [];
          for (let i = 0; i < this.dropzone.oannotation.links.length; i++) {
            newLinks.push(new OIDBLink(i + 1, this.dropzone.oannotation.links[i]));
          }

          this.appStorage.overwriteAnnotation(newLevels).then(
            () => {
              return this.appStorage.overwriteLinks(newLinks);
            }
          ).then(() => {
            this.navigate();
          }).catch((err) => {
            console.error(err);
          });
        } else {
          this.navigate();
        }
      },
      (error) => {
        if (error === 'file not supported') {
          this.modService.show('error', {
            text: this.langService.translate('reload-file.file not supported', {type: ''})
          }).catch((error2) => {
            console.error(error2);
          });
        }
      }
    );
  }

  ngOnInit() {
    if (this.settingsService.responsive.enabled === false) {
      this.validSize = window.innerWidth >= this.settingsService.responsive.fixedwidth;
    } else {
      this.validSize = true;
    }

    const loaduser = () => {
      if (this.appStorage.usemode !== 'demo') {
        if (!isUnset(this.appStorage.user)) {
          if (this.appStorage.user.id !== '-1') {
            this.member.id = this.appStorage.user.id;
          }

          if (this.appStorage.user.hasOwnProperty('project')) {
            this.member.project = this.appStorage.user.project;
          }

          if (this.appStorage.user.hasOwnProperty('jobno')
            && this.appStorage.user.jobno !== null && this.appStorage.user.jobno > -1) {
            this.member.jobno = this.appStorage.user.jobno.toString();
          }
        }
      } else {
        this.appStorage.usemode = null;
        this.appStorage.dataID = null;
        this.appStorage.user.id = '';
        this.appStorage.user.jobno = -1;
        this.appStorage.user.project = '';
        this.member = {
          id: '',
          agreement: '',
          project: '',
          jobno: '',
          password: ''
        };
      }
    };

    if (!this.appStorage.idbloaded) {
      this.subscrmanager.add(this.appStorage.loaded.subscribe(
        () => {
        },
        () => {
        },
        () => {
          loaduser();
        })
      );
    } else {
      loaduser();
    }

    new Promise<void>((resolve, reject) => {
      if (this.settingsService.isDBLoadded) {
        resolve();
      } else {
        this.subscrmanager.add(this.settingsService.dbloaded.subscribe(() => {
          resolve();
        }));
      }
    }).then(() => {
      this.settingsService.loadProjectSettings().then(() => {
        this.loadPojectsList();
      }).catch((error) => {
        console.error(error);
      });
    });

  }

  ngAfterViewInit() {
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  onSubmit(form: NgForm) {
    let newSession = false;
    let newSessionAfterOld = false;
    let continueSession = false;

    if (!this.isPasswordCorrect(this.member.project, this.member.password)) {
      this.modService.show('loginInvalid').catch((error) => {
        console.error(error);
      });
    } else {

      if ((this.member.jobno === null || this.member.jobno === undefined) || this.member.jobno === '') {
        this.member.jobno = '0';
      }

      if (this.appStorage.sessionfile !== null) {
        // last was offline mode, begin new Session
        newSession = true;

      } else {
        if (!(this.appStorage.dataID === null || this.appStorage.dataID === undefined) && typeof this.appStorage.dataID === 'number') {
          // last session was online session
          // check if credentials are available
          if (
            !(this.appStorage.user.project === null || this.appStorage.user.project === undefined) &&
            !(this.appStorage.user.jobno === null || this.appStorage.user.jobno === undefined) &&
            !(this.appStorage.user.id === null || this.appStorage.user.id === undefined)
          ) {
            // check if credentials are the same like before
            if (
              this.appStorage.user.id === this.member.id &&
              Number(this.appStorage.user.jobno) === Number(this.member.jobno) &&
              this.appStorage.user.project === this.member.project
            ) {
              continueSession = true;
            } else {
              newSessionAfterOld = true;
            }
          }
        } else {
          newSession = true;
        }
      }

      if (newSessionAfterOld) {
        this.api.setOnlineSessionToFree(this.appStorage).then(() => {
          this.createNewSession(form);
        }).catch((error) => {
          console.error(error);
        });
      }

      if (newSession) {
        this.createNewSession(form);
      } else if (continueSession) {
        this.api.fetchAnnotation(this.appStorage.dataID).then((json) => {
          if (isUnset(json.data)) {
            // job doesn't exist anymore
            this.createNewSession(form);
          } else {
            // continue job
            if (json.hasOwnProperty('message')) {
              const counter = (json.message === '') ? '0' : json.message;
              this.appStorage.sessStr.store('jobsLeft', Number(counter));
            }

            if (form.valid && this.agreementChecked
              && json.message !== '0'
            ) {
              if (this.appStorage.sessionfile !== null) {
                // last was offline mode
                this.appStorage.clearLocalStorage().catch((err) => {
                  console.error(err);
                });
              }

              if (this.appStorage.usemode === 'online'
                && json.data.hasOwnProperty('prompttext')) {
                // get transcript data that already exists
                const prompt = json.data.prompttext;
                this.appStorage.prompttext = (prompt) ? prompt : '';
              } else {
                this.appStorage.prompttext = '';
              }

              const res = this.appStorage.setSessionData(this.member, this.appStorage.dataID, this.appStorage.audioURL);
              if (res.error === '') {
                this.navigate();
              } else {
                alert(res.error);
              }
            } else {
              this.modService.show('loginInvalid').catch((error) => {
                console.error(error);
              });
            }
          }
        }).catch((error) => {
          this.modService.show('error', {
            text: 'Server cannot be requested. Please check if you are online.'
          }).catch((error2) => {
            console.error(error2);
          });
          console.error(error);
        });
      }
    }
  }

  canDeactivate(): Observable<boolean> | boolean {
    return (this.valid);
  }

  @HostListener('window:resize', ['$event'])
  onResize($event) {
    if (this.settingsService.responsive.enabled === false) {
      this.validSize = window.innerWidth >= this.settingsService.responsive.fixedwidth;
    } else {
      this.validSize = true;
    }
  }

  getDropzoneFileString(file: File | SessionFile) {
    const fsize: FileSize = Functions.getFileSize(file.size);
    return `${file.name} (${(Math.round(fsize.size * 100) / 100)} ${fsize.label})`;
  }

  getFileStatus(): string {
    if (!(this.dropzone.files === null || this.dropzone.files === undefined) && this.dropzone.files.length > 0 &&
      (!(this.dropzone.oaudiofile === null || this.dropzone.oaudiofile === undefined))) {
      // check conditions
      if ((this.appStorage.sessionfile === null || this.appStorage.sessionfile === undefined)
        || (this.dropzone.oaudiofile.name === this.appStorage.sessionfile.name)
        && (this.dropzone.oannotation === null || this.dropzone.oannotation === undefined)) {
        return 'start';
      } else {
        return 'new';
      }
    }

    return 'unknown';
  }

  getValidBrowsers(): string {
    let result = '';

    for (let i = 0; i < this.apc.octra.allowed_browsers.length; i++) {
      const browser = this.apc.octra.allowed_browsers[i];
      result += browser.name;
      if (i < this.apc.octra.allowed_browsers.length - 1) {
        result += ', ';
      }
    }

    return result;
  }

  loadPojectsList() {
    this.api.getProjects().then((json) => {
      if (Array.isArray(json.data)) {
        this.projects = json.data;

        if (!(this.settingsService.appSettings.octra.allowed_projects === null ||
          this.settingsService.appSettings.octra.allowed_projects === undefined)
          && this.settingsService.appSettings.octra.allowed_projects.length > 0) {
          // filter disabled projects
          this.projects = this.projects.filter((a) => {
            return (this.settingsService.appSettings.octra.allowed_projects.findIndex((b) => {
              return a === b.name;
            }) > -1);
          });
        }
        if (!(this.appStorage.user === null || this.appStorage.user === undefined) &&
          !(this.appStorage.user.project === null || this.appStorage.user.project === undefined) && this.appStorage.user.project !== '') {

          const found = this.projects.find(
            (x) => {
              return x === this.appStorage.user.project;
            });
          if ((found === null || found === undefined)) {
            // make sure that old project is in list
            this.projects.push(this.appStorage.user.project);
          }
        }
      }

      this.apiStatus = 'available';
    }).catch((error) => {
      console.error(`ERROR: could not load list of projects:\n${error}`);
      this.apiStatus = 'unavailable';
    });
  }

  public selectProject(event: HTMLSelectElement) {
    this.member.project = event.value;
  }

  public testFile(converter: Converter, file: File) {
    const reader: FileReader = new FileReader();
    reader.readAsText(file);
    reader.readAsText(file, 'utf-8');
  }

  onTranscriptionDelete() {
    this.modService.show('transcriptionDelete').then((answer: ModalDeleteAnswer) => {
      if (answer === ModalDeleteAnswer.DELETE) {
        this.newTranscription();
      }
    }).catch((error) => {
      console.error(error);
    });
  }

  public startDemo() {
    const audioExample = this.settingsService.getAudioExample(this.langService.getActiveLang());

    if (!isUnset(audioExample)) {
      this.member.id = 'demo_user';
      this.member.project = 'DemoProject';
      this.member.jobno = '123';

      // delete old data for fresh new session
      this.appStorage.clearSession();
      this.appStorage.clearLocalStorage().then(
        () => {
          this.appStorage.setSessionData(this.member, 21343134, audioExample.url);
          this.appStorage.usemode = 'demo';
          this.appStorage.prompttext = '';
          this.appStorage.servercomment = audioExample.description;
          this.appStorage.sessStr.store('jobsLeft', 1000);

          this.navigate();
        }
      ).catch((err) => {
        console.error(err);
      });
    }
  }

  public isPasswordCorrect(selectedProject, password) {
    if (!isUnset(this.settingsService.appSettings.octra.allowed_projects)) {
      const inputHash = sha256(password).toUpperCase();
      const projectData = this.settingsService.appSettings.octra.allowed_projects.find((a) => {
        return a.name === selectedProject;
      });

      if (!isUnset(projectData)) {
        if (projectData.hasOwnProperty('password') && projectData.password !== '') {
          return projectData.password.toUpperCase() === inputHash;
        }
      }
    }

    return true;
  }

  passwordExists() {
    if (!isUnset(this.settingsService.appSettings.octra.allowed_projects)) {
      const projectData = this.settingsService.appSettings.octra.allowed_projects.find((a) => {
        return a.name === this.member.project;
      });

      return (!isUnset(projectData) && projectData.hasOwnProperty('password')) && projectData.password !== '';
    }

    return false;
  }

  private navigate = (): void => {
    Functions.navigateTo(this.router, ['user'], AppInfo.queryParamsHandling).catch((error) => {
      console.error(error);
    });
  }

  private createNewSession(form: NgForm) {
    this.api.beginSession(this.member.project, this.member.id, Number(this.member.jobno)).then((json) => {

      if (form.valid && this.agreementChecked
        && json.message !== '0'
      ) {

        // delete old data for fresh new session
        this.appStorage.clearSession();
        this.appStorage.clearLocalStorage().then(
          () => {
            const res = this.appStorage.setSessionData(this.member, json.data.id, json.data.url);

            // get transcript data that already exists
            const jsonStr = JSON.stringify(json.data);
            this.appStorage.serverDataEntry = parseServerDataEntry(jsonStr);

            if (isUnset(this.appStorage.serverDataEntry.transcript) ||
              !Array.isArray(this.appStorage.serverDataEntry.transcript)) {
              this.appStorage.serverDataEntry.transcript = [];
            }

            if (isUnset(this.appStorage.serverDataEntry.logtext) ||
              !Array.isArray(this.appStorage.serverDataEntry.logtext)) {
              this.appStorage.serverDataEntry.logtext = [];
            }

            if (this.appStorage.usemode === 'online' && this.appStorage.serverDataEntry.hasOwnProperty('prompttext')) {
              // get transcript data that already exists
              const prompt = this.appStorage.serverDataEntry.prompttext;
              this.appStorage.prompttext = (prompt) ? prompt : '';
            } else {
              this.appStorage.prompttext = '';
            }

            if (this.appStorage.usemode === 'online' && this.appStorage.serverDataEntry.hasOwnProperty('comment')) {
              // get transcript data that already exists
              const comment = this.appStorage.serverDataEntry.comment;

              if (comment) {
                this.appStorage.servercomment = comment;
              }
            } else {
              this.appStorage.servercomment = '';
            }

            if (json.hasOwnProperty('message')) {
              const counter = (json.message === '') ? '0' : json.message;
              this.appStorage.sessStr.store('jobsLeft', Number(counter));
            }

            if (res.error === '') {
              this.navigate();
            } else {
              this.modService.show('error', res.error).catch((error) => {
                console.error(error);
              });
            }
          }
        ).catch((err) => {
          console.error(err);
        });
      } else {
        this.modService.show('loginInvalid').catch((error) => {
          console.error(error);
        });
      }
    }).catch((error) => {
      alert('Server cannot be requested. Please check if you are online.');
      return throwError(error);
    });
  }
}