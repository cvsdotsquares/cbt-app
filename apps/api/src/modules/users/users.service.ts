import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { parsePage, parseLimit } from '../../common/utils/pagination.util';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, page?: unknown, limit?: unknown, search?: string) {
    const p = parsePage(page);
    const l = parseLimit(limit);
    const where = {
      tenantId,
      ...(search && {
        OR: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (p - 1) * l,
        take: l,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          mfaEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: { include: { role: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, mfaSecret: __, ...safeUser } = user;
    return safeUser;
  }

  async getRoles(callerRoles: string[] = []) {
    const roles = await this.prisma.role.findMany({
      where: { isSystem: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
    if (!callerRoles.includes('SUPER_ADMIN')) {
      return roles.filter((r) => r.name !== 'SUPER_ADMIN');
    }
    return roles;
  }

  async create(
    tenantId: string,
    data: { email: string; password: string; firstName: string; lastName: string; roleIds?: string[] },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: data.email } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const roleIds = data.roleIds ?? [];

    if (roleIds.length) {
      const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, isSystem: true } });
      if (roles.length !== roleIds.length) throw new BadRequestException('One or more roles are invalid');
    }

    return this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        status: 'ACTIVE',
        emailVerified: true,
        userRoles: roleIds.length
          ? { create: roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });
  }

  async assignRole(userId: string, roleId: string, assignedBy: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId },
    });
    if (existing) throw new BadRequestException('Role already assigned');

    return this.prisma.userRole.create({
      data: { userId, roleId, assignedBy },
      include: { role: true },
    });
  }

  async removeRole(userId: string, roleId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const assignment = await this.prisma.userRole.findFirst({ where: { userId, roleId } });
    if (!assignment) throw new BadRequestException('Role not assigned');

    return this.prisma.userRole.delete({ where: { id: assignment.id } });
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
      password?: string;
    },
  ) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    if (data.email && data.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: data.email } },
      });
      if (existing) throw new ConflictException('Email already in use');
    }

    const updateData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      status?: typeof data.status;
      passwordHash?: string;
    } = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
    if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
    if (data.status !== undefined) updateData.status = data.status;
    if (data.password?.trim()) {
      updateData.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: { include: { role: { select: { id: true, name: true } } } },
      },
    });
  }

  async remove(id: string, tenantId: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        candidate: { select: { id: true } },
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.candidate) {
      throw new BadRequestException(
        'This user is a student account. Manage them from the Students page instead.',
      );
    }

    if (user.userRoles.some((ur) => ur.role.name === 'SUPER_ADMIN')) {
      throw new BadRequestException('Cannot delete a super admin account');
    }

    await this.prisma.session.deleteMany({ where: { userId: id } });

    return this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });
  }
}
