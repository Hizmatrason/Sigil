using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable
#pragma warning disable CA1861

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Sigil.Infrastructure.Migrations;

/// <inheritdoc />
public partial class Initial : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "audit_logs",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                action = table.Column<string>(type: "text", nullable: false),
                actor_email = table.Column<string>(type: "text", nullable: true),
                entity_type = table.Column<string>(type: "text", nullable: false),
                entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                meta = table.Column<string>(type: "text", nullable: true),
                ip_address = table.Column<string>(type: "text", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_audit_logs", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "companies",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                name = table.Column<string>(type: "text", nullable: false),
                slug = table.Column<string>(type: "text", nullable: false),
                path = table.Column<string>(type: "text", nullable: false),
                depth = table.Column<int>(type: "integer", nullable: false),
                status = table.Column<int>(type: "integer", nullable: false),
                contact_email = table.Column<string>(type: "text", nullable: true),
                metadata = table.Column<string>(type: "text", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_companies", x => x.id);
                table.ForeignKey(
                    name: "fk_companies_companies_parent_id",
                    column: x => x.parent_id,
                    principalTable: "companies",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "license_templates",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "text", nullable: false),
                product_code = table.Column<string>(type: "text", nullable: false),
                description = table.Column<string>(type: "text", nullable: true),
                default_offline_days = table.Column<int>(type: "integer", nullable: false),
                default_validity_days = table.Column<int>(type: "integer", nullable: false),
                status = table.Column<int>(type: "integer", nullable: false),
                current_version_id = table.Column<Guid>(type: "uuid", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_license_templates", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "roles",
            columns: table => new
            {
                id = table.Column<int>(type: "integer", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                code = table.Column<string>(type: "text", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_roles", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "users",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                email = table.Column<string>(type: "text", nullable: false),
                password_hash = table.Column<string>(type: "text", nullable: true),
                display_name = table.Column<string>(type: "text", nullable: true),
                is_operator = table.Column<bool>(type: "boolean", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                last_login_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_users", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "webhook_endpoints",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                url = table.Column<string>(type: "text", nullable: false),
                secret = table.Column<string>(type: "text", nullable: false),
                description = table.Column<string>(type: "text", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                events = table.Column<string[]>(type: "text[]", nullable: false),
                last_delivery_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_webhook_endpoints", x => x.id);
            });

        migrationBuilder.CreateTable(
            name: "signing_keys",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                template_id = table.Column<Guid>(type: "uuid", nullable: true),
                public_key = table.Column<byte[]>(type: "bytea", nullable: false),
                private_key_ref = table.Column<string>(type: "text", nullable: false),
                algorithm = table.Column<string>(type: "text", nullable: false),
                status = table.Column<int>(type: "integer", nullable: false),
                not_before = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                not_after = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_signing_keys", x => x.id);
                table.ForeignKey(
                    name: "fk_signing_keys_license_templates_template_id",
                    column: x => x.template_id,
                    principalTable: "license_templates",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "role_assignments",
            columns: table => new
            {
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                company_id = table.Column<Guid>(type: "uuid", nullable: false),
                role_id = table.Column<int>(type: "integer", nullable: false),
                granted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                granted_by = table.Column<Guid>(type: "uuid", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_role_assignments", x => new { x.user_id, x.company_id, x.role_id });
                table.ForeignKey(
                    name: "fk_role_assignments_companies_company_id",
                    column: x => x.company_id,
                    principalTable: "companies",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "fk_role_assignments_roles_role_id",
                    column: x => x.role_id,
                    principalTable: "roles",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "fk_role_assignments_users_user_id",
                    column: x => x.user_id,
                    principalTable: "users",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "webhook_deliveries",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                endpoint_id = table.Column<Guid>(type: "uuid", nullable: false),
                event_type = table.Column<string>(type: "text", nullable: false),
                payload = table.Column<string>(type: "text", nullable: false),
                status = table.Column<int>(type: "integer", nullable: false),
                attempt_count = table.Column<int>(type: "integer", nullable: false),
                response_status_code = table.Column<int>(type: "integer", nullable: true),
                response_body = table.Column<string>(type: "text", nullable: true),
                last_error = table.Column<string>(type: "text", nullable: true),
                next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                last_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_webhook_deliveries", x => x.id);
                table.ForeignKey(
                    name: "fk_webhook_deliveries_webhook_endpoints_endpoint_id",
                    column: x => x.endpoint_id,
                    principalTable: "webhook_endpoints",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "template_versions",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                template_id = table.Column<Guid>(type: "uuid", nullable: false),
                version = table.Column<int>(type: "integer", nullable: false),
                config_schema = table.Column<string>(type: "text", nullable: false),
                defaults = table.Column<string>(type: "text", nullable: false),
                signing_key_id = table.Column<Guid>(type: "uuid", nullable: false),
                changelog = table.Column<string>(type: "text", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_template_versions", x => x.id);
                table.ForeignKey(
                    name: "fk_template_versions_license_templates_template_id",
                    column: x => x.template_id,
                    principalTable: "license_templates",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "fk_template_versions_signing_keys_signing_key_id",
                    column: x => x.signing_key_id,
                    principalTable: "signing_keys",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "licenses",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                company_id = table.Column<Guid>(type: "uuid", nullable: false),
                template_id = table.Column<Guid>(type: "uuid", nullable: false),
                template_version_id = table.Column<Guid>(type: "uuid", nullable: false),
                license_key = table.Column<string>(type: "text", nullable: false),
                status = table.Column<int>(type: "integer", nullable: false),
                config = table.Column<string>(type: "text", nullable: false),
                hw_fingerprint = table.Column<string>(type: "text", nullable: true),
                offline_days = table.Column<int>(type: "integer", nullable: false),
                current_version = table.Column<int>(type: "integer", nullable: false),
                issued_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                activated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                last_heartbeat_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                revocation_reason = table.Column<string>(type: "text", nullable: true),
                created_by = table.Column<Guid>(type: "uuid", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_licenses", x => x.id);
                table.ForeignKey(
                    name: "fk_licenses_companies_company_id",
                    column: x => x.company_id,
                    principalTable: "companies",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_licenses_license_templates_template_id",
                    column: x => x.template_id,
                    principalTable: "license_templates",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_licenses_template_versions_template_version_id",
                    column: x => x.template_version_id,
                    principalTable: "template_versions",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "activations",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                license_id = table.Column<Guid>(type: "uuid", nullable: false),
                hw_fingerprint = table.Column<string>(type: "text", nullable: true),
                machine_name = table.Column<string>(type: "text", nullable: true),
                client_ip = table.Column<string>(type: "text", nullable: true),
                status = table.Column<int>(type: "integer", nullable: false),
                activated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                deactivated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                last_heartbeat_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_activations", x => x.id);
                table.ForeignKey(
                    name: "fk_activations_licenses_license_id",
                    column: x => x.license_id,
                    principalTable: "licenses",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "license_versions",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                license_id = table.Column<Guid>(type: "uuid", nullable: false),
                version = table.Column<int>(type: "integer", nullable: false),
                config = table.Column<string>(type: "text", nullable: false),
                signed_token = table.Column<string>(type: "text", nullable: false),
                signed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                signed_by = table.Column<Guid>(type: "uuid", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_license_versions", x => x.id);
                table.ForeignKey(
                    name: "fk_license_versions_licenses_license_id",
                    column: x => x.license_id,
                    principalTable: "licenses",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "heartbeats",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                license_id = table.Column<Guid>(type: "uuid", nullable: false),
                activation_id = table.Column<Guid>(type: "uuid", nullable: false),
                hw_fingerprint = table.Column<string>(type: "text", nullable: true),
                client_ip = table.Column<string>(type: "text", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_heartbeats", x => x.id);
                table.ForeignKey(
                    name: "fk_heartbeats_activations_activation_id",
                    column: x => x.activation_id,
                    principalTable: "activations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "fk_heartbeats_licenses_license_id",
                    column: x => x.license_id,
                    principalTable: "licenses",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.InsertData(
            table: "roles",
            columns: new[] { "id", "code" },
            values: new object[,]
            {
                { 1, "owner" },
                { 2, "admin" },
                { 3, "billing" },
                { 4, "viewer" }
            });

        migrationBuilder.CreateIndex(
            name: "ix_activations_license_id",
            table: "activations",
            column: "license_id");

        migrationBuilder.CreateIndex(
            name: "ix_audit_logs_created_at",
            table: "audit_logs",
            column: "created_at");

        migrationBuilder.CreateIndex(
            name: "ix_audit_logs_entity_type_entity_id",
            table: "audit_logs",
            columns: new[] { "entity_type", "entity_id" });

        migrationBuilder.CreateIndex(
            name: "ix_companies_parent_id_slug",
            table: "companies",
            columns: new[] { "parent_id", "slug" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_heartbeats_activation_id",
            table: "heartbeats",
            column: "activation_id");

        migrationBuilder.CreateIndex(
            name: "ix_heartbeats_license_id_created_at",
            table: "heartbeats",
            columns: new[] { "license_id", "created_at" });

        migrationBuilder.CreateIndex(
            name: "ix_license_templates_product_code",
            table: "license_templates",
            column: "product_code",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_license_versions_license_id_version",
            table: "license_versions",
            columns: new[] { "license_id", "version" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_licenses_company_id",
            table: "licenses",
            column: "company_id");

        migrationBuilder.CreateIndex(
            name: "ix_licenses_expires_at",
            table: "licenses",
            column: "expires_at");

        migrationBuilder.CreateIndex(
            name: "ix_licenses_license_key",
            table: "licenses",
            column: "license_key",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_licenses_status",
            table: "licenses",
            column: "status");

        migrationBuilder.CreateIndex(
            name: "ix_licenses_template_id",
            table: "licenses",
            column: "template_id");

        migrationBuilder.CreateIndex(
            name: "ix_licenses_template_version_id",
            table: "licenses",
            column: "template_version_id");

        migrationBuilder.CreateIndex(
            name: "ix_role_assignments_company_id",
            table: "role_assignments",
            column: "company_id");

        migrationBuilder.CreateIndex(
            name: "ix_role_assignments_role_id",
            table: "role_assignments",
            column: "role_id");

        migrationBuilder.CreateIndex(
            name: "ix_roles_code",
            table: "roles",
            column: "code",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_signing_keys_template_id",
            table: "signing_keys",
            column: "template_id");

        migrationBuilder.CreateIndex(
            name: "ix_template_versions_signing_key_id",
            table: "template_versions",
            column: "signing_key_id");

        migrationBuilder.CreateIndex(
            name: "ix_template_versions_template_id_version",
            table: "template_versions",
            columns: new[] { "template_id", "version" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_users_email",
            table: "users",
            column: "email",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "ix_webhook_deliveries_endpoint_id",
            table: "webhook_deliveries",
            column: "endpoint_id");

        migrationBuilder.CreateIndex(
            name: "ix_webhook_deliveries_status_next_attempt_at",
            table: "webhook_deliveries",
            columns: new[] { "status", "next_attempt_at" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "audit_logs");

        migrationBuilder.DropTable(
            name: "heartbeats");

        migrationBuilder.DropTable(
            name: "license_versions");

        migrationBuilder.DropTable(
            name: "role_assignments");

        migrationBuilder.DropTable(
            name: "webhook_deliveries");

        migrationBuilder.DropTable(
            name: "activations");

        migrationBuilder.DropTable(
            name: "roles");

        migrationBuilder.DropTable(
            name: "users");

        migrationBuilder.DropTable(
            name: "webhook_endpoints");

        migrationBuilder.DropTable(
            name: "licenses");

        migrationBuilder.DropTable(
            name: "companies");

        migrationBuilder.DropTable(
            name: "template_versions");

        migrationBuilder.DropTable(
            name: "signing_keys");

        migrationBuilder.DropTable(
            name: "license_templates");
    }
}