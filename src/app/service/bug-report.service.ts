import {Injectable} from '@angular/core';
import {BrowserInfo} from '../shared/BrowserInfo';
import {TranslateService} from '@ngx-translate/core';
import {AppInfo} from '../app.info';
import {SessionService} from './session.service';
import {isArray} from 'util';

export enum ConsoleType {
  LOG,
  INFO,
  WARN,
  ERROR
}

export interface ConsoleEntry {
  type: ConsoleType;
  message: string;
}

@Injectable()
export class BugReportService {
  get console(): ConsoleEntry[] {
    return this._console;
  }

  private _console: ConsoleEntry[] = [];

  constructor(private langService: TranslateService,
              private sessService: SessionService) {
  }

  public addEntry(type: ConsoleType, message: string) {
    const console: ConsoleEntry = {
      type: type,
      message: message
    };

    this._console.push(console);
  }

  public clear() {
    this._console = [];
  }

  public getPackage(): any {
    return {
      octra: {
        version: AppInfo.version,
        language: this.langService.currentLang,
        signed_in: this.sessService.logged_in,
        dataid: this.sessService.data_id,
        localmode: this.sessService.offline
      },
      system: {
        os: BrowserInfo.os.family,
        browser: BrowserInfo.browser + ' ' + BrowserInfo.version
      },
      entries: this._console
    };
  }

  public getText(): string {
    let result = '';
    const pkg = this.getPackage();

    for (const attr in pkg) {
      if (!isArray(pkg[attr]) && typeof pkg[attr] === 'object') {
        result += attr + '\n';
        result += '---------\n';

        for (const attr2 in pkg[attr]) {
          if (typeof pkg[attr][attr2] !== 'object' || pkg[attr][attr2] === null) {
            result += '  ' + attr2 + ':  ' + pkg[attr][attr2] + '\n';
          }
        }
      } else if (isArray(pkg[attr])) {
        result += attr + '\n';
        result += '---------\n';

        for (let i = 0; i < pkg[attr].length; i++) {
          result += '  ' + pkg[attr][i].type + '  ' + pkg[attr][i].message + '\n';
        }
      }
      result += '\n';
    }

    return result;
  }

}