import {OAnnotJSON, OAudiofile} from './AnnotJSON';
import {isNullOrUndefined} from 'util';
import {Level} from './Level';
import {Link} from './Link';

export class Annotation {
  set links(value: Link[]) {
    this._links = value;
  }
  get levels(): Level[] {
    return this._levels;
  }
  get links(): Link[] {
    return this._links;
  }
  get annotates(): string {
    return this._annotates;
  }

  get audiofile(): OAudiofile {
    return this._audiofile;
  }

  set audiofile(value: OAudiofile) {
    this._audiofile = value;
  }

  private _annotates: string;
  private _audiofile: OAudiofile;
  private _levels: Level[];
  private _links: Link[];

  constructor(annotates: string, audiofile: OAudiofile, levels?: Level[], links?: Link[]) {
    this._annotates = annotates;
    this._audiofile = audiofile;
    this._levels = [];
    this._links = [];

    if (!isNullOrUndefined(levels)) {
      this._levels = levels;
    }
    if (!isNullOrUndefined(links)) {
      this._links = links;
    }
  }

  public getObj(): OAnnotJSON {
    const result = new OAnnotJSON(this._audiofile.name, this._audiofile.samplerate, [], this._links);
    result.annotates = this._annotates;
    result.sampleRate = this._audiofile.samplerate;

    for (let i = 0; i < this._levels.length; i++) {
      const level = this._levels[i].getObj();
      result.levels.push(level);
    }

    return result;
  }
}
