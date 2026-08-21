import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsValidBirthDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidBirthDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const parsed = parseDateOnly(value);
          if (!parsed) return false;
          if (isNaN(parsed.getTime())) return false;
          return true;
        },
        defaultMessage(): string {
          return 'birthDate must be a valid date in YYYY-MM-DD format';
        },
      },
    });
  };
}

export function BirthDateInRange(minAge: number, maxAge: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'birthDateInRange',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [minAge, maxAge],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;
          const parsed = parseDateOnly(value);
          if (!parsed) return false;
          const [minAge, maxAge] = args.constraints as number[];
          const age = calculateAgeFromDate(parsed);
          return age >= minAge && age <= maxAge;
        },
        defaultMessage(args: ValidationArguments): string {
          const [minAge, maxAge] = args.constraints as number[];
          return `Child must be between ${minAge} and ${maxAge} years old`;
        },
      },
    });
  };
}

export function BirthDateNotFuture(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'birthDateNotFuture',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const parsed = parseDateOnly(value);
          if (!parsed) return false;
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return parsed <= today;
        },
        defaultMessage(): string {
          return 'birthDate must not be in the future';
        },
      },
    });
  };
}

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yStr, mStr, dStr] = value.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function calculateAgeFromDate(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
