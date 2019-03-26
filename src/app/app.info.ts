import {Converter} from './core/obj/Converters/Converter';
import {
  AnnotJSONConverter,
  CTMConverter,
  PartiturConverter,
  PraatTableConverter,
  PraatTextgridConverter,
  TextConverter
} from './core/obj/Converters';
import {MantisBugReporter} from './core/obj/BugAPI/MantisBugReporter';
import {OggFormat, WavFormat} from './media-components/obj/media/audio/AudioFormats';
import {BundleJSONConverter} from './core/obj/Converters/BundleJSONConverter';
import {EmailBugReporter} from './core/obj/BugAPI/EmailBugReporter';
import {NavigationExtras} from '@angular/router';
import {ELANConverter} from './core/obj/Converters/ELANConverter';
import {SRTConverter} from './core/obj/Converters/SRTConverter';

export class AppInfo {
  public static readonly audioformats = [
    new WavFormat(),
    new OggFormat()
  ];

  public static readonly bugreporters = [
    new MantisBugReporter(),
    new EmailBugReporter()
  ];

  public static readonly converters: Converter[] = [
    new AnnotJSONConverter(),
    new PraatTableConverter(),
    new PraatTextgridConverter(),
    new CTMConverter(),
    new PartiturConverter(),
    new BundleJSONConverter(),
    new TextConverter(),
    new ELANConverter(),
    new SRTConverter()
  ];

  public static readonly themes: string[] = [
    'default',
    'shortAudioFiles'
  ];

  static readonly version = '1.2.7';
  static readonly lastUpdate = '2018-03-15 17:00';

  public static readonly queryParamsHandling: NavigationExtras = {
    queryParamsHandling: '',
    preserveFragment: false
  };
}
