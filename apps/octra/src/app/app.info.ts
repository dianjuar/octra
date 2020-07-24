import {NavigationExtras} from '@angular/router';
import {EmailBugReporter} from './core/obj/BugAPI/EmailBugReporter';
import {
  AnnotJSONConverter,
  BundleJSONConverter,
  Converter,
  CTMConverter,
  PartiturConverter,
  PraatTableConverter,
  PraatTextgridConverter,
  TextConverter
} from './core/obj/Converters';
import {ELANConverter} from './core/obj/Converters/ELANConverter';
import {SRTConverter} from './core/obj/Converters/SRTConverter';
import {WebVTTConverter} from './core/obj/Converters/WebVTTConverter';
import {OggFormat, WavFormat} from '@octra/media';

declare var octraVersion: string;
declare var octraLastUpdated: string;

export class AppInfo {
  public static readonly audioformats = [
    new WavFormat(),
    new OggFormat()
  ];

  public static readonly bugreporters = [
    new EmailBugReporter()
  ];

  public static readonly converters: Converter[] = [
    new AnnotJSONConverter(),
    new PraatTableConverter(),
    new PraatTextgridConverter(),
    new CTMConverter(),
    new PartiturConverter(),
    new BundleJSONConverter(),
    new ELANConverter(),
    new SRTConverter(),
    new WebVTTConverter(),
    new TextConverter()
  ];

  public static readonly themes: string[] = [
    'default',
    'shortAudioFiles'
  ];

  static readonly version = octraVersion;
  static readonly lastUpdate = octraLastUpdated;
  static readonly manualURL = 'https://clarin.phonetik.uni-muenchen.de/apps/octra/manual/1.4.0/en/';

  static readonly debugging = true;

  static readonly maxAudioFileSize = 3000;

  public static readonly queryParamsHandling: NavigationExtras = {
    queryParamsHandling: '',
    preserveFragment: false
  };
}
