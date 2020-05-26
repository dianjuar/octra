import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {TranslocoService} from '@ngneat/transloco';
import {Functions} from 'octra-components';
import {AppInfo} from '../../../app.info';
import {SubscriptionManager} from 'octra-components';
import {AppStorageService, SettingsService} from '../../shared/service';

@Component({
  selector: 'octra-agreement',
  templateUrl: './agreement.component.html',
  styleUrls: ['./agreement.component.css']
})
export class AgreementComponent implements OnInit {

  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  constructor(public settService: SettingsService,
              private router: Router,
              private langService: TranslocoService,
              private appStorage: AppStorageService) {
    if ((this.settService.projectsettings === null || this.settService.projectsettings === undefined)) {
      Functions.navigateTo(this.router, ['/user/load'], AppInfo.queryParamsHandling)
        .catch((error) => {
          console.error(error);
        });
    }
  }

  ngOnInit() {
    console.log('agreement component called');
  }

  public toHTML(text: any): string {
    if (!(text === null || text === undefined)) {
      const currentLang = this.langService.getActiveLang();
      if (!(text[currentLang] === null || text[currentLang] === undefined)) {
        return text[currentLang].replace('\n', '<br/>');
      } else {
        for (const l in text) {
          if (!(text[l] === null || text[l] === undefined)) {
            return text[l].replace('\n', '<br/>');
          }
        }
      }
    } else {
      return '';
    }
  }

  logout() {
    this.settService.clearSettings();
    Functions.navigateTo(this.router, ['/logout'], AppInfo.queryParamsHandling).catch((error) => {
      console.error(error);
    });
  }

  accept() {
    if ((this.appStorage.agreement === null || this.appStorage.agreement === undefined)) {
      this.appStorage.agreement = {};
    }
    this.appStorage.agreement[this.appStorage.user.project] = true;
    this.appStorage.sessStr.store('agreement', this.appStorage.agreement);
    Functions.navigateTo(this.router, ['/user/transcr'], AppInfo.queryParamsHandling).catch((error) => {
      console.error(error);
    });
  }
}
