import { Body, Controller, Get, Inject, Param, Post, Put } from "@nestjs/common";

import {
  createProjectRequestSchema,
  type CreateProjectRequest,
  updateProjectRequestSchema,
  type UpdateProjectRequest,
} from "@bizo/contracts/projects";

import { ContractPipe } from "../common/contract.pipe.js";
import { RequestId } from "../common/request-id.decorator.js";
import { type AuthenticatedPrincipal } from "../security/principal.js";
import { Principal } from "../security/principal.decorator.js";
import { ProjectsService } from "./projects.service.js";

@Controller("businesses/:businessId/projects")
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post()
  create(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Body(new ContractPipe(createProjectRequestSchema)) input: CreateProjectRequest,
    @RequestId() requestId: string,
  ) {
    return this.projects.create(principal.userId, _businessId, input, requestId);
  }

  @Get()
  list(@Principal() principal: AuthenticatedPrincipal, @Param("businessId") _businessId: string) {
    return this.projects.list(principal.userId, _businessId);
  }

  @Get(":projectId")
  get(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.projects.get(principal.userId, _businessId, projectId);
  }

  @Put(":projectId")
  update(
    @Principal() principal: AuthenticatedPrincipal,
    @Param("businessId") _businessId: string,
    @Param("projectId") projectId: string,
    @Body(new ContractPipe(updateProjectRequestSchema)) input: UpdateProjectRequest,
    @RequestId() requestId: string,
  ) {
    return this.projects.update(principal.userId, _businessId, projectId, input, requestId);
  }
}
