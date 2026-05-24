export interface PersonName {
  displayName?: string;
  givenName?: string;
  familyName?: string;
}

export interface EmailAddress {
  value?: string;
  type?: string;
  formattedType?: string;
}

export interface PhoneNumber {
  value?: string;
  type?: string;
  formattedType?: string;
}

export interface Organization {
  name?: string;
  title?: string;
  department?: string;
}

export interface Address {
  formattedValue?: string;
  type?: string;
  formattedType?: string;
}

export interface Birthday {
  date?: { year?: number; month?: number; day?: number };
  text?: string;
}

export interface Photo {
  url?: string;
  default?: boolean;
}

export interface Url {
  value?: string;
  type?: string;
  formattedType?: string;
}

export interface Biography {
  value?: string;
}

export interface RawPerson {
  resourceName: string;
  etag?: string;
  names?: PersonName[];
  emailAddresses?: EmailAddress[];
  phoneNumbers?: PhoneNumber[];
  organizations?: Organization[];
  addresses?: Address[];
  birthdays?: Birthday[];
  photos?: Photo[];
  urls?: Url[];
  biographies?: Biography[];
}

export interface Contact {
  id: string;
  displayName: string;
  givenName: string;
  familyName: string;
  emails: EmailAddress[];
  phones: PhoneNumber[];
  organizations: Organization[];
  addresses: Address[];
  birthdays: Birthday[];
  photoUrl: string | null;
  urls: Url[];
  note: string;
}
