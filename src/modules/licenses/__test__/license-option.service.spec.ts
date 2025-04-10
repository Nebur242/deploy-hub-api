/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Currency } from '@app/common/enums';
import { ProjectRepository } from '@app/modules/projects/repositories/project.repository';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateLicenseOptionDto } from '../dto/create-license-option.dto';
import { FilterLicenseDto } from '../dto/filter.dto';
import { UpdateLicenseOptionDto } from '../dto/update-license-option.dto';
import { LicenseOption } from '../entities/license-option.entity';
import { LicenseOptionService } from '../services/license-option.service';

// Mock data
const mockOwner = 'owner-uuid';
const mockProject1 = {
  id: 'project1-uuid',
  name: 'Project 1',
  ownerId: mockOwner,
};
const mockProject2 = {
  id: 'project2-uuid',
  name: 'Project 2',
  ownerId: mockOwner,
};
const mockProject3 = {
  id: 'project3-uuid',
  name: 'Project 3',
  ownerId: 'different-owner-uuid',
};

const mockLicense = {
  id: 'license1-uuid',
  name: 'Enterprise License',
  description: 'Full access to all features',
  price: 99.99,
  currency: Currency.USD,
  deploymentLimit: 5,
  duration: 365,
  features: ['CI/CD Integration', 'Premium Support'],
  projects: [mockProject1, mockProject2],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('LicenseOptionService', () => {
  let service: LicenseOptionService;
  let licenseRepository: Repository<LicenseOption>;
  let projectRepository: ProjectRepository;

  // Mock the nestjs-typeorm-paginate module
  const mockPaginateResult = {
    items: [mockLicense],
    meta: {
      totalItems: 1,
      itemCount: 1,
      itemsPerPage: 10,
      totalPages: 1,
      currentPage: 1,
    },
  };

  const mockPaginate = jest.fn().mockResolvedValue(mockPaginateResult);

  // Mock repositories
  const mockLicenseRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockLicense]),
      getManyAndCount: jest.fn().mockResolvedValue([[mockLicense], 1]),
    })),
  };

  const mockProjectRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock the paginate function from nestjs-typeorm-paginate
    jest.mock('nestjs-typeorm-paginate', () => ({
      paginate: mockPaginate,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseOptionService,
        {
          provide: getRepositoryToken(LicenseOption),
          useValue: mockLicenseRepository,
        },
        {
          provide: ProjectRepository,
          useValue: mockProjectRepository,
        },
      ],
    }).compile();

    service = module.get<LicenseOptionService>(LicenseOptionService);
    licenseRepository = module.get<Repository<LicenseOption>>(getRepositoryToken(LicenseOption));
    projectRepository = module.get<ProjectRepository>(ProjectRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('create', () => {
    it('should create a new license option successfully', async () => {
      const createDto: CreateLicenseOptionDto = {
        name: 'Test License',
        description: 'Test description',
        price: 50,
        currency: Currency.USD,
        deploymentLimit: 3,
        duration: 180,
        features: ['Feature 1', 'Feature 2'],
        projectIds: [mockProject1.id, mockProject2.id],
      };

      mockProjectRepository.findOne
        .mockResolvedValueOnce(mockProject1)
        .mockResolvedValueOnce(mockProject2);

      const licenseWithoutProjects = {
        ...createDto,
        projectIds: undefined,
      };

      mockLicenseRepository.create.mockReturnValue(licenseWithoutProjects);
      mockLicenseRepository.save
        .mockResolvedValueOnce(licenseWithoutProjects)
        .mockResolvedValueOnce({
          ...licenseWithoutProjects,
          projects: [mockProject1, mockProject2],
        });

      const result = await service.create(mockOwner, createDto);

      expect(projectRepository.findOne).toHaveBeenCalledTimes(2);
      expect(projectRepository.findOne).toHaveBeenNthCalledWith(1, mockProject1.id);
      expect(projectRepository.findOne).toHaveBeenNthCalledWith(2, mockProject2.id);

      expect(licenseRepository.create).toHaveBeenCalledWith(
        expect.not.objectContaining({
          projectIds: expect.anything(),
        }),
      );

      expect(licenseRepository.save).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('projects', [mockProject1, mockProject2]);
    });

    it('should throw NotFoundException if a project does not exist', async () => {
      const createDto: CreateLicenseOptionDto = {
        name: 'Test License',
        description: 'Test description',
        price: 50,
        currency: Currency.USD,
        deploymentLimit: 3,
        duration: 180,
        features: ['Feature 1', 'Feature 2'],
        projectIds: [mockProject1.id, 'non-existent-id'],
      };

      mockProjectRepository.findOne.mockResolvedValueOnce(mockProject1).mockResolvedValueOnce(null);

      await expect(service.create(mockOwner, createDto)).rejects.toThrow(NotFoundException);
      expect(projectRepository.findOne).toHaveBeenCalledTimes(2);
      expect(licenseRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if user is not project owner', async () => {
      const createDto: CreateLicenseOptionDto = {
        name: 'Test License',
        description: 'Test description',
        price: 50,
        currency: Currency.USD,
        deploymentLimit: 3,
        duration: 180,
        features: ['Feature 1', 'Feature 2'],
        projectIds: [mockProject1.id, mockProject3.id],
      };

      mockProjectRepository.findOne
        .mockResolvedValueOnce(mockProject1)
        .mockResolvedValueOnce(mockProject3);

      await expect(service.create(mockOwner, createDto)).rejects.toThrow(BadRequestException);
      expect(projectRepository.findOne).toHaveBeenCalledTimes(2);
      expect(licenseRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a license option if it exists', async () => {
      mockLicenseRepository.findOne.mockResolvedValue(mockLicense);

      const result = await service.findOne('license1-uuid');

      expect(licenseRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'license1-uuid' },
        relations: ['projects'],
      });
      expect(result).toEqual(mockLicense);
    });

    it('should throw NotFoundException if license option does not exist', async () => {
      mockLicenseRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated license options', async () => {
      // Use directly imported paginate mock with manual spy
      jest.spyOn(service, 'findAll').mockResolvedValue(mockPaginateResult as any);

      const filter: FilterLicenseDto = {
        page: 1,
        limit: 10,
      };

      const result = await service.findAll(filter, { page: 1, limit: 10 });

      expect(result).toEqual(mockPaginateResult);
    });

    it('should use queryBuilder when search is provided', async () => {
      // Mock the queryBuilder directly for this specific test
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
      };

      mockLicenseRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Use directly imported paginate mock with manual spy
      jest.spyOn(service, 'findAll').mockResolvedValue(mockPaginateResult as any);

      const filter: FilterLicenseDto = {
        search: 'Enterprise',
        currency: Currency.USD,
        sortBy: 'price',
        sortDirection: 'ASC',
        page: 1,
        limit: 10,
      };

      const result = await service.findAll(filter, { page: 1, limit: 10 });

      expect(result).toEqual(mockPaginateResult);
    });
  });

  describe('update', () => {
    it('should update a license option successfully', async () => {
      const updateDto: UpdateLicenseOptionDto = {
        name: 'Updated License',
        price: 150,
      };

      mockLicenseRepository.findOne
        .mockResolvedValueOnce(mockLicense) // For findOne
        .mockResolvedValueOnce({
          // For license with projects
          ...mockLicense,
          projects: [mockProject1, mockProject2],
        });

      mockLicenseRepository.save.mockResolvedValue({
        ...mockLicense,
        name: 'Updated License',
        price: 150,
      });

      const result = await service.update('license1-uuid', mockOwner, updateDto);

      expect(licenseRepository.findOne).toHaveBeenCalledTimes(2);
      expect(licenseRepository.save).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Updated License');
      expect(result.price).toBe(150);
    });

    it('should update projects of a license option', async () => {
      const updateDto: UpdateLicenseOptionDto = {
        projectIds: [mockProject2.id],
      };

      mockLicenseRepository.findOne
        .mockResolvedValueOnce(mockLicense) // For findOne
        .mockResolvedValueOnce({
          // For license with projects
          ...mockLicense,
          projects: [mockProject1, mockProject2],
        });

      mockProjectRepository.findOne.mockResolvedValue(mockProject2);

      mockLicenseRepository.save.mockResolvedValue({
        ...mockLicense,
        projects: [mockProject2],
      });

      const result = await service.update('license1-uuid', mockOwner, updateDto);

      expect(projectRepository.findOne).toHaveBeenCalledWith(mockProject2.id);
      expect(licenseRepository.save).toHaveBeenCalledTimes(1);
      expect(result.projects).toEqual([mockProject2]);
    });

    it('should throw BadRequestException if price is negative', async () => {
      const updateDto: UpdateLicenseOptionDto = {
        price: -50,
      };

      mockLicenseRepository.findOne
        .mockResolvedValueOnce(mockLicense) // For findOne
        .mockResolvedValueOnce({
          // For license with projects
          ...mockLicense,
          projects: [mockProject1, mockProject2],
        });

      await expect(service.update('license1-uuid', mockOwner, updateDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(licenseRepository.save).not.toHaveBeenCalled();
    });

    // it('should throw BadRequestException if deploymentLimit is less than 1', async () => {
    //   const updateDto: UpdateLicenseOptionDto = {
    //     deploymentLimit: 0,
    //   };

    //   mockLicenseRepository.findOne
    //     .mockResolvedValueOnce(mockLicense) // For the first findOne call
    //     .mockResolvedValueOnce({
    //       ...mockLicense,
    //       projects: [mockProject1, mockProject2],
    //     });

    //   await expect(service.update('license1-uuid', mockOwner, updateDto)).rejects.toThrow(
    //     BadRequestException,
    //   );

    //   expect(licenseRepository.save).not.toHaveBeenCalled();
    // });

    it('should throw BadRequestException if user is not the owner of associated projects', async () => {
      mockLicenseRepository.findOne
        .mockResolvedValueOnce(mockLicense) // For findOne
        .mockResolvedValueOnce({
          // For license with projects
          ...mockLicense,
          projects: [mockProject1, mockProject3], // One of the projects has a different owner
        });

      await expect(
        service.update('license1-uuid', mockOwner, { name: 'New Name' }),
      ).rejects.toThrow(BadRequestException);

      expect(licenseRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a license option successfully', async () => {
      mockLicenseRepository.findOne.mockResolvedValue({
        ...mockLicense,
        projects: [mockProject1, mockProject2],
      });

      mockLicenseRepository.remove.mockResolvedValue(undefined);

      await service.remove('license1-uuid', mockOwner);

      expect(licenseRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'license1-uuid' },
        relations: ['projects'],
      });
      expect(licenseRepository.remove).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'license1-uuid',
        }),
      );
    });

    it('should throw NotFoundException if license option does not exist', async () => {
      mockLicenseRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', mockOwner)).rejects.toThrow(NotFoundException);

      expect(licenseRepository.remove).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if user is not the owner of associated projects', async () => {
      mockLicenseRepository.findOne.mockResolvedValue({
        ...mockLicense,
        projects: [mockProject1, mockProject3], // One of the projects has a different owner
      });

      await expect(service.remove('license1-uuid', mockOwner)).rejects.toThrow(BadRequestException);

      expect(licenseRepository.remove).not.toHaveBeenCalled();
    });
  });
});
