import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { User } from '../user/entities/user.entity';

export interface AuthResponse {
  access_token: string;
  user: User;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const user = await this.userService.findByEmail(email);

    // compare() re-hashes the candidate with the stored salt; the plain
    // password can never equal the stored hash directly
    const passwordMatches =
      user !== null && (await bcrypt.compare(password, user.passwordHash));

    // ONE generic error for both "no such email" and "wrong password" — telling
    // them apart turns this route into an account-enumeration oracle
    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');

    return this.issueToken(user);
  }

  /**
   * Account creation is a UserService concern; auth only adds the token.
   * Reusing create() keeps one copy of the hashing rules and the 409.
   */
  async signup(createUserDto: CreateUserDto): Promise<AuthResponse> {
    const user = await this.userService.create(createUserDto);

    return this.issueToken(user);
  }

  /**
   * A JWT is stateless: the server holds no session to destroy, and a signed
   * token stays valid until it expires. So sign-out is the client discarding
   * its token. Real revocation needs a denylist (or short-lived access tokens
   * plus refresh tokens) — deliberately out of scope here.
   */
  signOut(): { message: string } {
    return { message: 'Signed out — discard the access token on the client.' };
  }

  private async issueToken(user: User): Promise<AuthResponse> {
    // `sub` is the JWT standard claim for "who this token is about"
    const payload = { sub: user.id, email: user.email };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user,
    };
  }
}
