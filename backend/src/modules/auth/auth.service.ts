import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/role.enum.js';
import { User } from '../users/entities/user.entity.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({
      where: [{ phone: dto.phone }, { email: dto.email }],
    });
    if (existing) {
      throw new ConflictException(
        'Un compte existe déjà avec ce numéro ou cet e-mail.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      phone: dto.phone,
      email: dto.email,
      fullName: dto.fullName,
      passwordHash,
      role: UserRole.PROPRIETAIRE,
    });
    await this.usersRepo.save(user);

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.usersRepo.findOne({
      where: [{ phone: identifier }, { email: identifier }],
    });
    const ok = await bcrypt.compare(
      dto.password,
      user ? user.passwordHash : DUMMY_PASSWORD_HASH,
    );
    if (!user || !ok) {
      throw new UnauthorizedException(
        'Identifiants invalides. Vérifiez le numéro/téléphone ou l’e-mail et le mot de passe.',
      );
    }
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User) {
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('kudummy-identity-check', 10);
