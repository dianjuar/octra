import {Injectable} from '@angular/core';
import {ConsoleEntry} from './bug-report.service';
import {Subject} from 'rxjs';
import {IAnnotation, IIDBModeOptions, IIDBOption, OctraDatabase} from '../octra-database';
import {isUnset} from '@octra/utilities';
import {LoginMode} from '../../store';


@Injectable({
  providedIn: 'root'
})
export class IDBService {
  private _isReady = false;
  private _isOpened = false;

  private database: OctraDatabase;

  public get isReady(): boolean {
    return this._isReady;
  }

  constructor() {
  }

  /**
   * call this function after appSettings were loaded.
   * @param dbName
   */
  public initialize(dbName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.database = new OctraDatabase(dbName);
      this.database.onReady.subscribe(() => {
        this._isReady = true;

        if (this._isOpened) {
          resolve();
        }
      });

      this.database.open().then(() => {
        this._isOpened = true;

        if (this._isReady) {
          resolve();
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }

  /**
   * clears all annotaiton data
   */
  public clearAnnotationData(mode: LoginMode): Promise<any> {
    return this.database.clearDataOfMode(mode, 'annotation');
  }

  /**
   * clears all options
   */
  public clearModeOptions(mode: LoginMode): Promise<any> {
    return this.database.clearDataOfMode(mode, 'options');
  }

  /**
   * clears all options
   */
  public clearOptions(mode: LoginMode): Promise<any> {
    return this.database.options.clear();
  }

  /**
   * loads console entries.
   */
  public loadConsoleEntries(): Promise<ConsoleEntry[]> {
    return new Promise<ConsoleEntry[]>((resolve, reject) => {
      this.database.options.get('console').then((entry) => {
        if (!isUnset(entry)) {
          resolve(entry.value as ConsoleEntry[]);
        } else {
          resolve([]);
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }

  /**
   * saves console entries.
   * @param entries
   */
  public saveConsoleEntries(entries: ConsoleEntry[]) {
    return this.database.options.put({
      name: 'console',
      value: entries
    });
  }

  /**
   * load options
   * @param variables
   */
  public loadOptions = (variables: { attribute: string, key: string }[]): Subject<IIDBOption[]> => {
    const subject = new Subject<{
      value: any;
      name: string;
    }[]>();

    const keys = variables.map(a => a.key);
    this.database.options.bulkGet(keys).then((values) => {
      subject.next(values.filter(a => !isUnset(a)));
    }).catch((error) => {
      console.error(error);
      subject.error(error);
    });

    return subject;
  }

  /**
   * load all logs
   */
  public loadLogs(mode: LoginMode): Promise<any[]> {
    return this.database.loadDataOfMode<any[]>(mode, 'logs', []);
  }

  /**
   * load annotation
   */
  public loadAnnotation(mode: LoginMode) {
    return this.database.loadDataOfMode(mode, 'annotation', null);
  }

  /**
   * save option
   * @param key
   * @param value
   */
  public saveOption(key: string, value: any) {
    if (this.isReady) {
      return this.database.options.put({name: key, value}, key);
    } else {
      console.error(new Error(`can't save option ${key}, because idb is not ready.`));
    }
  }

  public saveModeOptions(mode: LoginMode, options: IIDBModeOptions) {
    return this.database.saveModeData(mode, 'options', options);
  }

  /**
   * save one log item.
   */
  public saveLogs(mode: LoginMode, logs: any[]) {
    return this.database.saveModeData(mode, 'logs', logs);
  }

  /**
   * save one annotation level.
   */
  public saveAnnotation(mode: LoginMode, annotation: IAnnotation) {
    return this.database.saveModeData(mode, 'annotation', annotation);
  }

  /**
   * clears logging data
   */
  public clearLoggingData(mode: LoginMode): Promise<any> {
    return this.database.clearDataOfMode(mode, 'logs');
  }

  /**
   * removes one item from table
   * @param tableName
   * @param key
   */
  public remove(tableName: string, key: string | number) {
    return this.database[tableName].delete(key);
  }
}
