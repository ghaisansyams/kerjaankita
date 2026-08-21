import { PrismaClient, RoleScope, PriorityLevel } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Industries
  const industries = [
    { key: "general", name: "General", description: "Industry-neutral defaults" },
    { key: "it_services", name: "IT Services", description: "Software houses, consultancies, agencies" },
    { key: "marketing", name: "Marketing Agency", description: "Campaigns, content, creative delivery" },
    { key: "construction", name: "Construction", description: "Sites, work orders, inspections, handover" },
    { key: "education", name: "Education", description: "Courses, cohorts, assignments, grading" },
    { key: "healthcare", name: "Healthcare", description: "Cases, treatment plans, follow-ups" },
    { key: "manufacturing", name: "Manufacturing", description: "Production batches, QC, maintenance" },
    { key: "logistics", name: "Logistics", description: "Shipments, routes, fleet operations" },
    { key: "property", name: "Property", description: "Developments, units, handover, maintenance" },
    { key: "government", name: "Government", description: "Programmes, public works, compliance" },
    { key: "startup", name: "Startup", description: "Product squads, roadmap, iteration" },
  ];

  for (const ind of industries) {
    await prisma.industry.upsert({
      where: { key: ind.key },
      update: { name: ind.name, description: ind.description },
      create: ind,
    });
  }
  console.log("✅ Seeded industries");

  // 2. Permissions catalogue
  const permissions = [
    // organization
    { key: "organization.update", category: "organization", name: "Update organization", description: "Edit organization profile" },
    { key: "organization.delete", category: "organization", name: "Delete organization", description: "Permanently remove the organization" },
    { key: "organization.settings.update", category: "organization", name: "Manage settings", description: "Edit settings, terminology, business rules" },
    { key: "organization.member.manage", category: "organization", name: "Manage members", description: "Add, remove and change member roles" },
    { key: "organization.role.manage", category: "organization", name: "Manage roles", description: "Create and edit custom roles" },
    { key: "invitation.manage", category: "organization", name: "Manage invitations", description: "Invite and revoke invitations" },
    // workspace
    { key: "workspace.create", category: "workspace", name: "Create workspace", description: null },
    { key: "workspace.update", category: "workspace", name: "Update workspace", description: null },
    { key: "workspace.delete", category: "workspace", name: "Delete workspace", description: null },
    { key: "workspace.member.manage", category: "workspace", name: "Manage workspace members", description: null },
    // team
    { key: "team.manage", category: "team", name: "Manage teams", description: "Create teams and manage membership" },
    // accounts
    { key: "account.manage", category: "account", name: "Manage accounts", description: "Create and edit accounts and contacts" },
    // project
    { key: "project.create", category: "project", name: "Create project", description: null },
    { key: "project.update", category: "project", name: "Update project", description: null },
    { key: "project.delete", category: "project", name: "Delete project", description: null },
    { key: "project.member.manage", category: "project", name: "Manage project members", description: null },
    { key: "project.view.all", category: "project", name: "View all projects", description: "See every project regardless of membership" },
    { key: "milestone.manage", category: "project", name: "Manage milestones", description: null },
    // task
    { key: "task.create", category: "task", name: "Create task", description: null },
    { key: "task.update.any", category: "task", name: "Update any task", description: "Edit any task, including transitions" },
    { key: "task.update.own", category: "task", name: "Update assigned task", description: "Edit only tasks assigned to you" },
    { key: "task.delete", category: "task", name: "Delete task", description: null },
    { key: "task.assign", category: "task", name: "Assign task", description: null },
    // collaboration
    { key: "comment.create", category: "comment", name: "Comment", description: null },
    { key: "comment.moderate", category: "comment", name: "Moderate comments", description: "Delete anyone's comment" },
    { key: "attachment.upload", category: "attachment", name: "Upload files", description: null },
    { key: "attachment.manage", category: "attachment", name: "Manage files", description: "Delete or edit any file" },
    { key: "attachment.share_guest", category: "attachment", name: "Share files with guests", description: "Expose a file in the guest portal" },
    // configuration
    { key: "workflow.manage", category: "config", name: "Manage workflows", description: "Define statuses and transitions" },
    { key: "customfield.manage", category: "config", name: "Manage custom fields", description: null },
    { key: "template.manage", category: "config", name: "Manage templates", description: null },
    { key: "automation.manage", category: "config", name: "Manage automation", description: null },
    { key: "tag.manage", category: "config", name: "Manage tags", description: null },
    // reporting
    { key: "report.view", category: "reporting", name: "View reports", description: null },
    { key: "report.export", category: "reporting", name: "Export reports", description: null },
    // mom (0020)
    { key: "mom.create", category: "work", name: "Create meeting minutes", description: "Create MOM documents" },
    { key: "mom.update", category: "work", name: "Edit meeting minutes", description: "Edit MOM documents" },
    { key: "mom.delete", category: "work", name: "Delete meeting minutes", description: "Delete MOM documents" },
    { key: "mom.export", category: "work", name: "Export meeting minutes", description: "Export a MOM to PDF" },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, description: perm.description, category: perm.category },
      create: perm,
    });
  }
  console.log("✅ Seeded permissions");

  // 3. System roles
  const roles = [
    { key: "org_owner", name: "Owner", description: "Full control of the organization", scope: RoleScope.organization, isSystem: true, isDefault: false, rank: 0 },
    { key: "org_admin", name: "Admin", description: "Administers the organization", scope: RoleScope.organization, isSystem: true, isDefault: false, rank: 10 },
    { key: "org_manager", name: "Manager", description: "Runs projects, accounts and reporting", scope: RoleScope.organization, isSystem: true, isDefault: false, rank: 20 },
    { key: "org_member", name: "Member", description: "Standard internal contributor", scope: RoleScope.organization, isSystem: true, isDefault: true, rank: 30 },
    { key: "org_guest", name: "Guest", description: "External collaborator — read-only", scope: RoleScope.organization, isSystem: true, isDefault: false, rank: 90 },
    { key: "ws_admin", name: "Workspace Admin", description: "Administers a workspace", scope: RoleScope.workspace, isSystem: true, isDefault: false, rank: 10 },
    { key: "ws_member", name: "Workspace Member", description: "Works inside a workspace", scope: RoleScope.workspace, isSystem: true, isDefault: true, rank: 30 },
    { key: "proj_lead", name: "Project Lead", description: "Leads delivery of a project", scope: RoleScope.project, isSystem: true, isDefault: false, rank: 10 },
    { key: "proj_contributor", name: "Contributor", description: "Delivers assigned work", scope: RoleScope.project, isSystem: true, isDefault: true, rank: 30 },
    { key: "proj_reviewer", name: "Reviewer / QA", description: "Reviews and approves work", scope: RoleScope.project, isSystem: true, isDefault: false, rank: 20 },
    { key: "proj_viewer", name: "Viewer", description: "Read-only access to a project", scope: RoleScope.project, isSystem: true, isDefault: false, rank: 80 },
  ];

  for (const r of roles) {
    const existing = await prisma.role.findFirst({
      where: { key: r.key, organizationId: null },
    });
    if (existing) {
      await prisma.role.update({
        where: { id: existing.id },
        data: { name: r.name, description: r.description, scope: r.scope, isSystem: r.isSystem, isDefault: r.isDefault, rank: r.rank },
      });
    } else {
      await prisma.role.create({
        data: {
          key: r.key,
          name: r.name,
          description: r.description,
          scope: r.scope,
          isSystem: r.isSystem,
          isDefault: r.isDefault,
          rank: r.rank,
          organizationId: null,
        },
      });
    }
  }
  console.log("✅ Seeded system roles");

  // 4. Role Permissions
  const allPermissions = await prisma.permission.findMany();
  const permMap = new Map(allPermissions.map((p) => [p.key, p.id]));

  const allRoles = await prisma.role.findMany({ where: { organizationId: null } });
  const roleMap = new Map(allRoles.map((r) => [r.key, r.id]));

  const rolePermGrants: Record<string, string[] | "all" | "all_except_delete"> = {
    org_owner: "all",
    org_admin: "all_except_delete",
    org_manager: [
      "workspace.create", "workspace.update", "workspace.member.manage",
      "team.manage", "account.manage",
      "project.create", "project.update", "project.delete", "project.member.manage",
      "project.view.all", "milestone.manage",
      "task.create", "task.update.any", "task.update.own", "task.delete", "task.assign",
      "comment.create", "comment.moderate",
      "attachment.upload", "attachment.manage", "attachment.share_guest",
      "workflow.manage", "customfield.manage", "template.manage", "tag.manage",
      "report.view", "report.export", "invitation.manage",
      "mom.create", "mom.update", "mom.export",
    ],
    org_member: [
      "task.create", "task.update.own",
      "comment.create", "attachment.upload", "report.view",
    ],
    ws_admin: [
      "workspace.update", "workspace.member.manage",
      "project.create", "project.update", "project.member.manage", "project.view.all",
      "milestone.manage", "task.create", "task.update.any", "task.assign",
      "comment.create", "attachment.upload", "attachment.manage", "report.view",
    ],
    ws_member: [
      "task.create", "task.update.own", "comment.create", "attachment.upload",
    ],
    proj_lead: [
      "project.update", "project.member.manage", "milestone.manage",
      "task.create", "task.update.any", "task.delete", "task.assign",
      "comment.create", "comment.moderate",
      "attachment.upload", "attachment.manage", "attachment.share_guest", "report.view",
    ],
    proj_reviewer: [
      "task.update.any", "task.update.own", "comment.create", "attachment.upload",
    ],
    proj_contributor: [
      "task.create", "task.update.own", "comment.create", "attachment.upload",
    ],
  };

  for (const [roleKey, grant] of Object.entries(rolePermGrants)) {
    const roleId = roleMap.get(roleKey);
    if (!roleId) continue;

    let targetPermIds: string[] = [];
    if (grant === "all") {
      targetPermIds = allPermissions.map((p) => p.id);
    } else if (grant === "all_except_delete") {
      targetPermIds = allPermissions.filter((p) => p.key !== "organization.delete").map((p) => p.id);
    } else {
      targetPermIds = grant.map((k) => permMap.get(k)).filter(Boolean) as string[];
    }

    for (const permId of targetPermIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId: permId },
        },
        update: {},
        create: { roleId, permissionId: permId },
      });
    }
  }
  console.log("✅ Seeded role permissions");

  // 5. System Project Templates
  const itIndustry = await prisma.industry.findUnique({ where: { key: "it_services" } });
  const marketingIndustry = await prisma.industry.findUnique({ where: { key: "marketing" } });
  const constrIndustry = await prisma.industry.findUnique({ where: { key: "construction" } });

  const templates = [
    {
      name: "Software Delivery",
      industryId: itIndustry?.id,
      description: "Discovery → build → QA → launch",
      defaultDurationDays: 60,
      tasks: [
        { title: "Requirements & discovery", description: "Gather and document scope", priority: PriorityLevel.high, position: 0, startOffsetDays: 0, durationDays: 5, estimatedHours: 24 },
        { title: "Technical design", description: "Architecture and data model", priority: PriorityLevel.high, position: 1, startOffsetDays: 5, durationDays: 5, estimatedHours: 20 },
        { title: "Implementation", description: "Build the agreed scope", priority: PriorityLevel.medium, position: 2, startOffsetDays: 10, durationDays: 30, estimatedHours: 160 },
        { title: "QA & UAT", description: "Test and fix defects", priority: PriorityLevel.high, position: 3, startOffsetDays: 40, durationDays: 10, estimatedHours: 40 },
        { title: "Launch", description: "Deploy and hand over", priority: PriorityLevel.critical, position: 4, startOffsetDays: 50, durationDays: 5, estimatedHours: 16 },
      ],
    },
    {
      name: "Marketing Campaign",
      industryId: marketingIndustry?.id,
      description: "Brief → creative → approval → publish",
      defaultDurationDays: 30,
      tasks: [
        { title: "Campaign brief", description: "Objectives, audience, budget", priority: PriorityLevel.high, position: 0, startOffsetDays: 0, durationDays: 3, estimatedHours: 8 },
        { title: "Creative production", description: "Copy, design, assets", priority: PriorityLevel.medium, position: 1, startOffsetDays: 3, durationDays: 12, estimatedHours: 48 },
        { title: "Client approval", description: "Review and sign-off", priority: PriorityLevel.high, position: 2, startOffsetDays: 15, durationDays: 5, estimatedHours: 10 },
        { title: "Publish & monitor", description: "Schedule, publish, report", priority: PriorityLevel.medium, position: 3, startOffsetDays: 20, durationDays: 10, estimatedHours: 20 },
      ],
    },
    {
      name: "Construction Handover",
      industryId: constrIndustry?.id,
      description: "Site prep → build → inspection → handover",
      defaultDurationDays: 120,
      tasks: [
        { title: "Site preparation", description: "Permits, survey, mobilisation", priority: PriorityLevel.high, position: 0, startOffsetDays: 0, durationDays: 14, estimatedHours: 80 },
        { title: "Main works", description: "Primary construction phase", priority: PriorityLevel.critical, position: 1, startOffsetDays: 14, durationDays: 75, estimatedHours: 600 },
        { title: "Inspection", description: "Quality and compliance checks", priority: PriorityLevel.high, position: 2, startOffsetDays: 89, durationDays: 14, estimatedHours: 60 },
        { title: "Snagging & handover", description: "Defect list and client handover", priority: PriorityLevel.high, position: 3, startOffsetDays: 103, durationDays: 17, estimatedHours: 60 },
      ],
    },
  ];

  for (const tpl of templates) {
    let t = await prisma.projectTemplate.findFirst({
      where: { name: tpl.name, organizationId: null },
    });
    if (!t) {
      t = await prisma.projectTemplate.create({
        data: {
          name: tpl.name,
          description: tpl.description,
          industryId: tpl.industryId,
          defaultDurationDays: tpl.defaultDurationDays,
          isSystem: true,
          organizationId: null,
        },
      });
    }

    for (const task of tpl.tasks) {
      const exists = await prisma.projectTemplateTask.findFirst({
        where: { templateId: t.id, title: task.title },
      });
      if (!exists) {
        await prisma.projectTemplateTask.create({
          data: {
            templateId: t.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            position: task.position,
            startOffsetDays: task.startOffsetDays,
            durationDays: task.durationDays,
            estimatedHours: task.estimatedHours,
          },
        });
      }
    }
  }
  console.log("✅ Seeded project templates");

  // 6. Organization & Initial Team Members
  const itInd = await prisma.industry.findUnique({ where: { key: "it_services" } });
  let org = await prisma.organization.findUnique({ where: { slug: "spero-lab" } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Spero Lab",
        slug: "spero-lab",
        industryId: itInd?.id,
        plan: "pro",
      },
    });
    await prisma.organizationSetting.create({
      data: {
        organizationId: org.id,
      },
    });
  }

  let ws = await prisma.workspace.findFirst({
    where: { organizationId: org.id, isDefault: true },
  });
  if (!ws) {
    ws = await prisma.workspace.create({
      data: {
        organizationId: org.id,
        name: "Main Workspace",
        slug: "main",
        isDefault: true,
      },
    });
  }

  // Ensure default task workflow and statuses exist for Spero Lab
  let defaultWf = await prisma.workflow.findFirst({
    where: { organizationId: org.id, entity: "task", isDefault: true },
  });
  if (!defaultWf) {
    defaultWf = await prisma.workflow.create({
      data: {
        organizationId: org.id,
        workspaceId: ws.id,
        name: "Default Workflow",
        entity: "task",
        isDefault: true,
        isSystem: true,
      },
    });

    const defaultStatuses = [
      { key: "backlog", name: "Backlog", category: "backlog", color: "#94A3B8", position: 0, isInitial: true, isFinal: false, autoProgress: 0 },
      { key: "todo", name: "To Do", category: "todo", color: "#64748B", position: 1, isInitial: false, isFinal: false, autoProgress: 0 },
      { key: "in_progress", name: "In Progress", category: "in_progress", color: "#3B82F6", position: 2, isInitial: false, isFinal: false, autoProgress: 50 },
      { key: "review", name: "In Review", category: "review", color: "#F59E0B", position: 3, isInitial: false, isFinal: false, autoProgress: 80 },
      { key: "done", name: "Done", category: "done", color: "#10B981", position: 4, isInitial: false, isFinal: true, autoProgress: 100 },
    ];

    for (const st of defaultStatuses) {
      await prisma.workflowStatus.create({
        data: {
          organizationId: org.id,
          workflowId: defaultWf.id,
          key: `${st.key}_${Date.now().toString(36)}`,
          name: st.name,
          category: st.category as any,
          color: st.color,
          position: st.position,
          isInitial: st.isInitial,
          isFinal: st.isFinal,
          autoProgress: st.autoProgress,
        },
      });
    }
  }

  const defaultPassword = "Password123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const teamMembers = [
    { email: "dio@spero.id", fullName: "Galih Aldio Putra", roleKey: "org_owner", wsRoleKey: "ws_admin" },
    { email: "fikri@spero.id", fullName: "Fikri Hasani", roleKey: "org_admin", wsRoleKey: "ws_admin" },
    { email: "hajid@spero.id", fullName: "Hajid Al Akhtar", roleKey: "org_manager", wsRoleKey: "ws_member" },
    { email: "aji@spero.id", fullName: "Aji", roleKey: "org_member", wsRoleKey: "ws_member" },
  ];

  for (const m of teamMembers) {
    let profile = await prisma.profile.findFirst({
      where: { email: { equals: m.email, mode: "insensitive" } },
    });

    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          id: crypto.randomUUID(),
          email: m.email,
          fullName: m.fullName,
          passwordHash,
          isActive: true,
        },
      });
    } else {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: {
          passwordHash,
          fullName: m.fullName,
          isActive: true,
        },
      });
    }

    const orgRole = roleMap.get(m.roleKey);
    if (orgRole) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: org.id, userId: profile.id } },
      });
      if (existingMember) {
        await prisma.organizationMember.update({
          where: { id: existingMember.id },
          data: { roleId: orgRole, status: "active" },
        });
      } else {
        await prisma.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: profile.id,
            roleId: orgRole,
            status: "active",
          },
        });
      }
    }

    const wsRole = roleMap.get(m.wsRoleKey);
    if (wsRole && ws) {
      const existingWsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: ws.id, userId: profile.id } },
      });
      if (existingWsMember) {
        await prisma.workspaceMember.update({
          where: { id: existingWsMember.id },
          data: { roleId: wsRole },
        });
      } else {
        await prisma.workspaceMember.create({
          data: {
            organizationId: org.id,
            workspaceId: ws.id,
            userId: profile.id,
            roleId: wsRole,
          },
        });
      }
    }
  }
  console.log("✅ Seeded initial team accounts with password:", defaultPassword);

  console.log("✨ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
