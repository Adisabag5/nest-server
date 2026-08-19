import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class SignInDto {
  @IsEmail()
  email!: string;

  // deliberately no @MinLength here: login validates credentials, not password
  // policy. Rejecting a short password with a 400 would leak that the policy
  // changed, and it tells an attacker their guess was malformed rather than wrong.
  @IsString()
  @IsNotEmpty()
  password!: string;
}
