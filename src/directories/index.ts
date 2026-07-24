import { BaseDirectoryProvider } from './baseDirectory';
import { JustdialDirectoryProvider } from './justdial';
import { PractoDirectoryProvider } from './practo';
import { LybrateDirectoryProvider } from './lybrate';
import { SulekhaDirectoryProvider } from './sulekha';
import { GoogleBusinessDirectoryProvider } from './googleBusiness';

export function getAllDirectoryProviders(): BaseDirectoryProvider[] {
  return [
    new GoogleBusinessDirectoryProvider(),
    new JustdialDirectoryProvider(),
    new PractoDirectoryProvider(),
    new LybrateDirectoryProvider(),
    new SulekhaDirectoryProvider()
  ];
}
