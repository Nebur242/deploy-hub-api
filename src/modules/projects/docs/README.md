# Projects Module

## Overview

The Projects Module is responsible for managing projects within the Deploy Hub API. This module allows users to create, manage, and deploy various projects, offering integration with the Deployment Module and Licenses Module to control access and deployment capabilities.

## Features

- Project creation and management
- Project ownership and access control
- License association with projects
- Project categorization
- Project deployment integration

## Entities

### Project

The `Project` entity represents a deployable project in the system and contains:

- Basic project information (name, description)
- Project owner and contributors
- Associated licenses
- Deploy settings
- Categories and tags
- Repository information

## Services

### ProjectService

Provides methods for:

- Creating and updating projects
- Finding and filtering projects
- Managing project access control
- Handling project settings
- Managing project-license associations

## Controllers

The module provides REST endpoints for project management:

- `POST /projects` - Create a new project
- `GET /projects` - Get all projects with filtering
- `GET /projects/:id` - Get a specific project
- `PATCH /projects/:id` - Update a project
- `DELETE /projects/:id` - Delete a project
- `POST /projects/:id/licenses` - Associate licenses with a project

## Integration Points

The Projects Module integrates with:

- **Licenses Module**: For associating licenses with projects
- **Deployment Module**: For handling project deployments
- **Users Module**: For managing project ownership and access
- **Categories Module**: For project categorization

## Usage

### Creating a Project

```typescript
// Example: Creating a new project
const createProjectDto: CreateProjectDto = {
  name: 'My Web Application',
  description: 'A web application for managing tasks',
  repositoryUrl: 'https://github.com/username/repo',
  categoryIds: ['category-id-1', 'category-id-2'],
  isPublic: true,
};

const project = await projectService.create(userId, createProjectDto);
```

### Finding Projects

```typescript
// Example: Finding all projects with filtering
const filterOptions: FilterProjectsDto = {
  search: 'web',
  categoryId: 'category-id',
  page: 1,
  limit: 10,
  sortBy: 'name',
  sortDirection: 'ASC',
};

const projects = await projectService.findAll(filterOptions);
```

### Updating a Project

```typescript
// Example: Updating a project
const updateProjectDto: UpdateProjectDto = {
  name: 'Updated Project Name',
  description: 'Updated project description',
};

const updatedProject = await projectService.update(projectId, userId, updateProjectDto);
```

### Managing Project Licenses

```typescript
// Example: Adding licenses to a project
await projectService.addLicenses(projectId, userId, ['license-id-1', 'license-id-2']);
```

## Access Control

Projects have different access levels:

1. **Owner**: Full access to project management
2. **Contributor**: Limited modification access
3. **Public access**: Read-only access to public projects

## Error Handling

The module includes error handling for:

- Project not found
- Unauthorized access
- Invalid project data
- License association errors
