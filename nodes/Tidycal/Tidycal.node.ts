import { NodeConnectionTypes, NodeApiError, NodeOperationError, type IDataObject, type IExecuteFunctions, type IHttpRequestOptions, type INodeExecutionData, type INodeType, type INodeTypeDescription, type JsonObject } from "n8n-workflow";
import { requestWithRetry, resolveServerBaseUrl } from "../../shared/http";

// Generated with ts-morph
type CredentialApplication = { credentialType: string; type: 'apiKey' | 'basic' | 'bearer' | 'oauth2' | 'custom'; location?: 'header' | 'query'; parameter?: string; injections?: Array<{ target: 'header' | 'query' | 'body'; name: string; value: string }> };
type RetryContract = { mode: string; retryConnectionFailures?: boolean; retryTimeouts?: boolean; retryRateLimits?: boolean; retryServerErrors?: boolean; maxAttempts: number; maxElapsedMs: number; baseBackoffMs: number; maxBackoffMs: number; jitterRatio: number; idempotency?: { target: 'header' | 'query' | 'body'; parameter: string } };
type PaginationContract = { style: string; page?: string; limit?: string; cursor?: string; responseCursor?: string; hasMore?: string; itemPath?: string; advancement?: string; maxPages: number; maxItems: number; maxElapsedMs: number; maxMemoryBytes: number; repeatedCursorLimit: number; repeatedPageLimit: number; pageSize: number };

function normalizeParameterValue(value: unknown): IDataObject[string] {
  if (value && typeof value === 'object' && 'value' in value) return (value as { value: IDataObject[string] }).value;
  return value as IDataObject[string];
}


type BodyFieldContract = {
  name: string;
  displayName?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  format?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  pattern?: string;
  fields?: BodyFieldContract[];
  items?: BodyFieldContract;
  additionalValue?: BodyFieldContract;
  alternatives?: BodyFieldContract[];
  composition?: 'oneOf' | 'anyOf';
  representation?: string;
  nullable?: boolean;
};

function normalizeJsonValue(value: unknown, label: string, context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[] | string | number | boolean | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as IDataObject | IDataObject[] | string | number | boolean | null;
    } catch (error) {
      throw new NodeOperationError(context.getNode(), `${label} must be valid JSON: ${(error as Error).message}`, { itemIndex });
    }
  }
  if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value as IDataObject | IDataObject[] | string | number | boolean | null;
  throw new NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}


function validateBodyValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): void {
  if (value === undefined || value === '') {
    if (contract.required) throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
    return;
  }
  if (value === null) {
    if (contract.nullable) return;
    throw new NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
  }
  if (contract.alternatives?.length) {
    selectAlternativeValue(value, contract, path, context, itemIndex);
    return;
  }
  if (contract.type === 'string' && typeof value !== 'string') throw new NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
  if (contract.type === 'boolean' && typeof value !== 'boolean') throw new NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
  if (contract.type === 'number' && typeof value !== 'number') throw new NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
  if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) throw new NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
  if (contract.enum?.length) {
    const enumValueMatches = (candidate: unknown): boolean => candidate === value ||
      (candidate === null && value === 'null') ||
      (candidate === 'null' && value === null) ||
      Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
    const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
    const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
      ? value.every((item) => contract.enum!.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
      : contract.enum.some(enumValueMatches);
    if (!matches) throw new NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
  }
  if (contract.type === 'number' || contract.type === 'integer') {
    const numeric = value as number;
    if (contract.minValue !== undefined && numeric < contract.minValue) throw new NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
    if (contract.maxValue !== undefined && numeric > contract.maxValue) throw new NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
  }
  if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value)) throw new NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
  if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
  if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
    try {
      new URL(value);
    } catch {
      throw new NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
    }
  }
  if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
  if (contract.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
    const objectValue = value as IDataObject;
    for (const child of contract.fields ?? []) validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
    if (contract.additionalValue) {
      const known = new Set((contract.fields ?? []).map((field) => field.name));
      for (const [key, childValue] of Object.entries(objectValue)) {
        if (!known.has(key)) {
          if (contract.additionalValue.alternatives?.length && contract.additionalValue.representation === 'raw') continue;
          validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
        }
      }
    }
  }
  if (contract.type === 'array') {
    if (!Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
    if (contract.items) value.forEach((item, index) => validateBodyValue(item, contract.items!, `${path}[${index}]`, context, itemIndex));
  }
}

function setBodyField(body: IDataObject, contract: BodyFieldContract, value: unknown, context: IExecuteFunctions, itemIndex: number): void {
  const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
    ? normalizeJsonValue(value, contract.displayName ?? contract.name, context, itemIndex)
    : normalizeParameterValue(value);
  const selected = contract.alternatives?.length ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
  validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
  body[contract.name] = selected as IDataObject[string];
}


function selectAlternativeValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
  const selectedName = String((value as IDataObject).schemaAlternative ?? '');
  const selected = (contract.alternatives ?? []).find((alternative) => alternative.name === selectedName);
  if (!selected) throw new NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${(contract.alternatives ?? []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
  const selectedValue = (value as IDataObject).value;
  validateBodyValue(selectedValue, selected, path, context, itemIndex);
  return selectedValue;
}




function selectResponseFields(value: IDataObject, fields: string[]): IDataObject {
  if (fields.length === 0) return value;
  const selected: IDataObject = {};
  if (value.id !== undefined) selected.id = value.id;
  for (const field of fields) if (value[field] !== undefined) selected[field] = value[field];
  return selected;
}

function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').filter(Boolean).reduce((current: unknown, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    return (current as IDataObject)[segment];
  }, value);
}

export class Tidycal implements INodeType {
  description: INodeTypeDescription = {
        displayName: "TidyCal",
        name: "tidycal",
        icon: {
            light: "file:tidycal.svg",
            dark: "file:tidycal.dark.svg"
        },
        group: [],
        version: [
            1
        ],
        subtitle: "={{((JSON.parse(\"\\u007b\\\"account\\\":\\u007b\\\"get-account\\\":\\\"getAccount: account\\\"\\u007d,\\\"bookingTypes\\\":\\u007b\\\"create-booking\\\":\\\"createBooking: bookingType\\\",\\\"create-booking-type\\\":\\\"createBookingType: bookingType\\\",\\\"list-booking-type-timeslots\\\":\\\"listAvailableTimeslots: bookingType\\\",\\\"list-booking-types\\\":\\\"listBookingTypes: bookingType\\\"\\u007d,\\\"bookings\\\":\\u007b\\\"cancel-booking\\\":\\\"cancelBooking: booking\\\",\\\"get-booking\\\":\\\"getBooking: booking\\\",\\\"list-bookings\\\":\\\"listBookings: booking\\\"\\u007d,\\\"contacts\\\":\\u007b\\\"create-contact\\\":\\\"createContact: contact\\\",\\\"list-contacts\\\":\\\"listContacts: contact\\\"\\u007d,\\\"teams\\\":\\u007b\\\"create-team-booking-type\\\":\\\"createTeamBookingType: team\\\",\\\"get-team\\\":\\\"getTeam: team\\\",\\\"list-team-booking-types\\\":\\\"listTeamBookingTypes: team\\\",\\\"list-team-bookings\\\":\\\"listTeamBookings: team\\\",\\\"list-team-users\\\":\\\"listTeamUsers: team\\\",\\\"list-teams\\\":\\\"listTeams: team\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
        description: "TidyCal is an online scheduling tool for booking pages, appointment management, and paid bookings",
        documentationUrl: "https://api.example.com//tidycal.com/api",
        hints: [
            {
                message: "Operation \"list-team-booking-types\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"list-team-bookings\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            }
        ],
        defaults: {
            name: "TidyCal"
        },
        usableAsTool: true,
        inputs: [
            NodeConnectionTypes.Main
        ],
        outputs: [
            NodeConnectionTypes.Main
        ],
        credentials: [],
        properties: [
            {
                displayName: "Resource",
                name: "resource",
                type: "options",
                noDataExpression: true,
                default: "account",
                options: [
                    {
                        name: "Account",
                        value: "account"
                    },
                    {
                        name: "Booking",
                        value: "bookings"
                    },
                    {
                        name: "Booking Type",
                        value: "bookingTypes"
                    },
                    {
                        name: "Contact",
                        value: "contacts"
                    },
                    {
                        name: "Team",
                        value: "teams"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "account"
                        ]
                    }
                },
                default: "get-account",
                options: [
                    {
                        name: "Get",
                        value: "get-account",
                        action: "Get account",
                        description: "Returns account details for the authenticated user"
                    }
                ]
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "account"
                        ],
                        operation: [
                            "get-account"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ]
                    }
                },
                default: "create-booking",
                options: [
                    {
                        name: "Create",
                        value: "create-booking-type",
                        action: "Create booking type",
                        description: "Creates a booking type for the authenticated account"
                    },
                    {
                        name: "Create Booking",
                        value: "create-booking",
                        action: "Create booking booking types",
                        description: "Creates one booking with starts_at or package sessions with bookings[]. the array takes precedence; data returns a booking object or array, respectively. booking types."
                    },
                    {
                        name: "List",
                        value: "list-booking-types",
                        action: "List booking types",
                        description: "Lists booking types available to the authenticated account"
                    },
                    {
                        name: "List Available Timeslots",
                        value: "list-booking-type-timeslots",
                        action: "List available timeslots booking types",
                        description: "Lists available time slots for the specified booking type"
                    }
                ]
            },
            {
                displayName: "Booking Type",
                name: "bookingType",
                type: "number",
                default: 0,
                required: true,
                description: "The ID of the booking type",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking"
                        ]
                    }
                }
            },
            {
                displayName: "Email",
                name: "email",
                type: "string",
                default: "",
                required: true,
                description: "Email address of the person booking",
                placeholder: "e.g. john@example.com",
                hint: "Expected format: email",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking"
                        ]
                    }
                }
            },
            {
                displayName: "Name",
                name: "name",
                type: "string",
                default: "",
                required: true,
                description: "Name of the person booking",
                placeholder: "e.g. John Doe",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking"
                        ]
                    }
                }
            },
            {
                displayName: "Timezone",
                name: "timezone",
                type: "string",
                default: "",
                required: true,
                description: "Time zone for the booking, such as america/los_angeles",
                placeholder: "e.g. America/Los_Angeles",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Booking Questions",
                        name: "booking_questions",
                        type: "json",
                        default: [],
                        description: "Answers to the booking type\u2019s questions"
                    },
                    {
                        displayName: "Bookings",
                        name: "bookings",
                        type: "json",
                        default: [],
                        description: "Session start times for a package or multi-session booking; overrides starts_at when supplied",
                        placeholder: "e.g. [object Object],[object Object]"
                    },
                    {
                        displayName: "Starts At",
                        name: "starts_at",
                        type: "dateTime",
                        default: "",
                        description: "UTC start time for a single booking; ignored when bookings is supplied",
                        placeholder: "e.g. 2024-03-20T10:00:00Z"
                    }
                ]
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Description",
                name: "description",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. Book a 30 minute meeting with me",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking-type"
                        ]
                    }
                }
            },
            {
                displayName: "Duration Minutes",
                name: "duration_minutes",
                type: "number",
                default: 0,
                required: true,
                placeholder: "e.g. 30",
                typeOptions: {
                    minValue: 1
                },
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking-type"
                        ]
                    }
                }
            },
            {
                displayName: "Title",
                name: "title",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 30 Minute Meeting",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking-type"
                        ]
                    }
                }
            },
            {
                displayName: "URL Slug",
                name: "url_slug",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 30-minute-meeting",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking-type"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking-type"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Approval Required",
                        name: "approval_required",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable approval required",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Booking Availability Interval Minutes",
                        name: "booking_availability_interval_minutes",
                        type: "number",
                        default: 15,
                        placeholder: "e.g. 30",
                        typeOptions: {
                            minValue: 15,
                            maxValue: 1440
                        }
                    },
                    {
                        displayName: "Booking Threshold",
                        name: "booking_threshold",
                        type: "number",
                        default: 0,
                        description: "Minimum booking notice in minutes. omit for the 120-minute default; use 0 for no minimum.",
                        placeholder: "e.g. 120",
                        typeOptions: {
                            minValue: 0,
                            maxValue: 15000
                        }
                    },
                    {
                        displayName: "Booking Type Category ID",
                        name: "booking_type_category_id",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 1"
                    },
                    {
                        displayName: "Currency Code",
                        name: "currency_code",
                        type: "string",
                        default: "",
                        description: "ISO 4217 currency code; defaults to the account currency",
                        placeholder: "e.g. USD"
                    },
                    {
                        displayName: "Display Seats Remaining",
                        name: "display_seats_remaining",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable display seats remaining",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Latest Availability Days",
                        name: "latest_availability_days",
                        type: "number",
                        default: 60,
                        placeholder: "e.g. 90",
                        typeOptions: {
                            minValue: 0,
                            maxValue: 36500
                        }
                    },
                    {
                        displayName: "Max Bookings",
                        name: "max_bookings",
                        type: "number",
                        default: 1,
                        placeholder: "e.g. 1",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Max Guest Invites Per Booker",
                        name: "max_guest_invites_per_booker",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 0",
                        typeOptions: {
                            minValue: 0,
                            maxValue: 10
                        }
                    },
                    {
                        displayName: "Padding Minutes",
                        name: "padding_minutes",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 15",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Payment Platform",
                        name: "payment_platform",
                        type: "options",
                        default: "stripe",
                        description: "Connected payment platform; required when price is greater than 0",
                        placeholder: "e.g. stripe",
                        options: [
                            {
                                name: "Paypal",
                                value: "paypal"
                            },
                            {
                                name: "Stripe",
                                value: "stripe"
                            },
                            {
                                name: "Tidycal",
                                value: "tidycal"
                            }
                        ]
                    },
                    {
                        displayName: "Price",
                        name: "price",
                        type: "number",
                        default: 0,
                        description: "Booking price; 0 is free. currency controls precision: whole amounts for zero-decimal currencies, up to two decimals otherwise. uses currency_code or the account currency.",
                        placeholder: "e.g. 25",
                        typeOptions: {
                            minValue: 0,
                            maxValue: 99999999.99
                        }
                    },
                    {
                        displayName: "Private",
                        name: "private",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable private",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Redirect URL",
                        name: "redirect_url",
                        type: "string",
                        default: "",
                        placeholder: "e.g. https://example.com/thank-you"
                    }
                ]
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "create-booking-type"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Booking Type",
                name: "bookingType",
                type: "number",
                default: 0,
                required: true,
                description: "The ID of the booking type",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "list-booking-type-timeslots"
                        ]
                    }
                }
            },
            {
                displayName: "Starts At",
                name: "starts_at",
                type: "dateTime",
                default: "",
                required: true,
                description: "Start of the UTC date-time range for available timeslots",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "list-booking-type-timeslots"
                        ]
                    }
                }
            },
            {
                displayName: "Ends At",
                name: "ends_at",
                type: "dateTime",
                default: "",
                required: true,
                description: "End of the UTC date-time range for available timeslots",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "list-booking-type-timeslots"
                        ]
                    }
                }
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "list-booking-type-timeslots"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Page",
                name: "page",
                type: "number",
                default: 0,
                required: true,
                description: "Page number to return",
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "list-booking-types"
                        ]
                    }
                }
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookingTypes"
                        ],
                        operation: [
                            "list-booking-types"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ]
                    }
                },
                default: "cancel-booking",
                options: [
                    {
                        name: "Cancel",
                        value: "cancel-booking",
                        action: "Cancel booking",
                        description: "Cancels the booking identified by the booking ID"
                    },
                    {
                        name: "Get",
                        value: "get-booking",
                        action: "Get booking",
                        description: "Returns the booking identified by the booking ID"
                    },
                    {
                        name: "List",
                        value: "list-bookings",
                        action: "List bookings",
                        description: "Lists bookings for the authenticated account"
                    }
                ]
            },
            {
                displayName: "Booking",
                name: "booking",
                type: "number",
                default: 0,
                required: true,
                description: "The ID of the booking to cancel",
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "cancel-booking"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "cancel-booking"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Reason",
                        name: "reason",
                        type: "string",
                        default: "",
                        description: "Reason for cancelling the booking, if provided",
                        placeholder: "e.g. Client requested cancellation"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "cancel-booking"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "created_at",
                    "updated_at",
                    "booking_type_id",
                    "cancelled_at",
                    "contact_id",
                    "ends_at",
                    "meeting_id",
                    "meeting_url",
                    "starts_at"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "cancel-booking"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Booking Type ID",
                        value: "booking_type_id"
                    },
                    {
                        name: "Cancelled At",
                        value: "cancelled_at"
                    },
                    {
                        name: "Contact",
                        value: "contact"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created At",
                        value: "created_at"
                    },
                    {
                        name: "Ends At",
                        value: "ends_at"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Meeting ID",
                        value: "meeting_id"
                    },
                    {
                        name: "Meeting URL",
                        value: "meeting_url"
                    },
                    {
                        name: "Payment",
                        value: "payment"
                    },
                    {
                        name: "Questions",
                        value: "questions"
                    },
                    {
                        name: "Starts At",
                        value: "starts_at"
                    },
                    {
                        name: "Timezone",
                        value: "timezone"
                    },
                    {
                        name: "Updated At",
                        value: "updated_at"
                    }
                ]
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "cancel-booking"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Booking",
                name: "booking",
                type: "number",
                default: 0,
                required: true,
                description: "The ID of the booking",
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "get-booking"
                        ]
                    }
                }
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "get-booking"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "created_at",
                    "updated_at",
                    "booking_type_id",
                    "cancelled_at",
                    "contact_id",
                    "ends_at",
                    "meeting_id",
                    "meeting_url",
                    "starts_at"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "get-booking"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Booking Type ID",
                        value: "booking_type_id"
                    },
                    {
                        name: "Cancelled At",
                        value: "cancelled_at"
                    },
                    {
                        name: "Contact",
                        value: "contact"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created At",
                        value: "created_at"
                    },
                    {
                        name: "Ends At",
                        value: "ends_at"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Meeting ID",
                        value: "meeting_id"
                    },
                    {
                        name: "Meeting URL",
                        value: "meeting_url"
                    },
                    {
                        name: "Payment",
                        value: "payment"
                    },
                    {
                        name: "Questions",
                        value: "questions"
                    },
                    {
                        name: "Starts At",
                        value: "starts_at"
                    },
                    {
                        name: "Timezone",
                        value: "timezone"
                    },
                    {
                        name: "Updated At",
                        value: "updated_at"
                    }
                ]
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "get-booking"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Starts At",
                name: "starts_at",
                type: "string",
                default: "",
                required: true,
                description: "Return bookings starting at or after this date",
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "list-bookings"
                        ]
                    }
                }
            },
            {
                displayName: "Ends At",
                name: "ends_at",
                type: "string",
                default: "",
                required: true,
                description: "Return bookings ending before this date",
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "list-bookings"
                        ]
                    }
                }
            },
            {
                displayName: "Cancelled",
                name: "cancelled",
                type: "boolean",
                default: false,
                required: true,
                description: "Whether set true for cancelled bookings, false for active bookings, or omit to include all",
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "list-bookings"
                        ]
                    }
                }
            },
            {
                displayName: "Page",
                name: "page",
                type: "number",
                default: 0,
                required: true,
                description: "Page number to return",
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "list-bookings"
                        ]
                    }
                }
            },
            {
                displayName: "Include Teams",
                name: "include_teams",
                type: "boolean",
                default: false,
                required: true,
                description: "Whether include bookings made through teams",
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "list-bookings"
                        ]
                    }
                }
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "bookings"
                        ],
                        operation: [
                            "list-bookings"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ]
                    }
                },
                default: "create-contact",
                options: [
                    {
                        name: "Create",
                        value: "create-contact",
                        action: "Create contact",
                        description: "Creates a contact for the authenticated account"
                    },
                    {
                        name: "List",
                        value: "list-contacts",
                        action: "List contacts",
                        description: "Lists contacts for the authenticated account"
                    }
                ]
            },
            {
                displayName: "Email",
                name: "email",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. john@example.com",
                hint: "Expected format: email",
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "create-contact"
                        ]
                    }
                }
            },
            {
                displayName: "Name",
                name: "name",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. John Doe",
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "create-contact"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "create-contact"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        placeholder: "e.g. America/Los_Angeles"
                    }
                ]
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "create-contact"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Page",
                name: "page",
                type: "number",
                default: 0,
                required: true,
                description: "Page number",
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "list-contacts"
                        ]
                    }
                }
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "list-contacts"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ]
                    }
                },
                default: "create-team-booking-type",
                options: [
                    {
                        name: "Create Team Booking Type",
                        value: "create-team-booking-type",
                        action: "Create team booking type",
                        description: "Creates a booking type for the specified team"
                    },
                    {
                        name: "Get",
                        value: "get-team",
                        action: "Get team",
                        description: "Returns details for the specified team"
                    },
                    {
                        name: "List",
                        value: "list-teams",
                        action: "List teams",
                        description: "Lists teams the authenticated user can access"
                    },
                    {
                        name: "List Team Booking Types",
                        value: "list-team-booking-types",
                        action: "List team booking types",
                        description: "Lists booking types for the specified team"
                    },
                    {
                        name: "List Team Bookings",
                        value: "list-team-bookings",
                        action: "List team bookings",
                        description: "Lists bookings for the specified team"
                    },
                    {
                        name: "List Team Users",
                        value: "list-team-users",
                        action: "List team users",
                        description: "Lists users in the specified team"
                    }
                ]
            },
            {
                displayName: "Team",
                name: "team",
                type: "number",
                default: 0,
                required: true,
                description: "The ID of the team",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "create-team-booking-type"
                        ]
                    }
                }
            },
            {
                displayName: "Description",
                name: "description",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. Book a 30 minute meeting with me",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "create-team-booking-type"
                        ]
                    }
                }
            },
            {
                displayName: "Duration Minutes",
                name: "duration_minutes",
                type: "number",
                default: 0,
                required: true,
                placeholder: "e.g. 30",
                typeOptions: {
                    minValue: 1
                },
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "create-team-booking-type"
                        ]
                    }
                }
            },
            {
                displayName: "Title",
                name: "title",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 30 Minute Meeting",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "create-team-booking-type"
                        ]
                    }
                }
            },
            {
                displayName: "URL Slug",
                name: "url_slug",
                type: "string",
                default: "",
                required: true,
                placeholder: "e.g. 30-minute-meeting",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "create-team-booking-type"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "create-team-booking-type"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Approval Required",
                        name: "approval_required",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable approval required",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Booking Availability Interval Minutes",
                        name: "booking_availability_interval_minutes",
                        type: "number",
                        default: 15,
                        placeholder: "e.g. 30",
                        typeOptions: {
                            minValue: 15,
                            maxValue: 1440
                        }
                    },
                    {
                        displayName: "Booking Threshold",
                        name: "booking_threshold",
                        type: "number",
                        default: 0,
                        description: "Minimum booking notice in minutes. omit for the 120-minute default; use 0 for no minimum.",
                        placeholder: "e.g. 120",
                        typeOptions: {
                            minValue: 0,
                            maxValue: 15000
                        }
                    },
                    {
                        displayName: "Booking Type Category ID",
                        name: "booking_type_category_id",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 1"
                    },
                    {
                        displayName: "Currency Code",
                        name: "currency_code",
                        type: "string",
                        default: "",
                        description: "ISO 4217 currency code; defaults to the account currency",
                        placeholder: "e.g. USD"
                    },
                    {
                        displayName: "Display Seats Remaining",
                        name: "display_seats_remaining",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable display seats remaining",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Latest Availability Days",
                        name: "latest_availability_days",
                        type: "number",
                        default: 60,
                        placeholder: "e.g. 90",
                        typeOptions: {
                            minValue: 0,
                            maxValue: 36500
                        }
                    },
                    {
                        displayName: "Max Bookings",
                        name: "max_bookings",
                        type: "number",
                        default: 1,
                        placeholder: "e.g. 1",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Max Guest Invites Per Booker",
                        name: "max_guest_invites_per_booker",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 0",
                        typeOptions: {
                            minValue: 0,
                            maxValue: 10
                        }
                    },
                    {
                        displayName: "Padding Minutes",
                        name: "padding_minutes",
                        type: "number",
                        default: 0,
                        placeholder: "e.g. 15",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Payment Platform",
                        name: "payment_platform",
                        type: "options",
                        default: "stripe",
                        description: "Connected payment platform; required when price is greater than 0",
                        placeholder: "e.g. stripe",
                        options: [
                            {
                                name: "Paypal",
                                value: "paypal"
                            },
                            {
                                name: "Stripe",
                                value: "stripe"
                            },
                            {
                                name: "Tidycal",
                                value: "tidycal"
                            }
                        ]
                    },
                    {
                        displayName: "Price",
                        name: "price",
                        type: "number",
                        default: 0,
                        description: "Booking price; 0 is free. currency controls precision: whole amounts for zero-decimal currencies, up to two decimals otherwise. uses currency_code or the account currency.",
                        placeholder: "e.g. 25",
                        typeOptions: {
                            minValue: 0,
                            maxValue: 99999999.99
                        }
                    },
                    {
                        displayName: "Private",
                        name: "private",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable private",
                        placeholder: "e.g. false"
                    },
                    {
                        displayName: "Redirect URL",
                        name: "redirect_url",
                        type: "string",
                        default: "",
                        placeholder: "e.g. https://example.com/thank-you"
                    }
                ]
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "create-team-booking-type"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Team",
                name: "team",
                type: "number",
                default: 0,
                required: true,
                description: "The ID of the team",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "get-team"
                        ]
                    }
                }
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "get-team"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Team",
                name: "team",
                type: "number",
                default: 0,
                required: true,
                description: "The ID of the team",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-team-booking-types"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-team-booking-types"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Page",
                        name: "page",
                        type: "number",
                        default: 0,
                        description: "Page number to return"
                    }
                ]
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-team-booking-types"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Team",
                name: "team",
                type: "number",
                default: 0,
                required: true,
                description: "The ID of the team",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-team-bookings"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-team-bookings"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Cancelled",
                        name: "cancelled",
                        type: "boolean",
                        default: false,
                        description: "Whether set true for cancelled bookings, false for active bookings, or omit to include all"
                    },
                    {
                        displayName: "Email",
                        name: "email",
                        type: "string",
                        default: "",
                        description: "Filter bookings by the booker\u2019s email address",
                        placeholder: "name@email.com",
                        hint: "Expected format: email"
                    },
                    {
                        displayName: "End Date",
                        name: "end_date",
                        type: "string",
                        default: "",
                        description: "Filter for bookings ending before this date (yyyy-mm-dd)"
                    },
                    {
                        displayName: "Host ID",
                        name: "host_id",
                        type: "number",
                        default: 0,
                        description: "Filter by the team member\u2019s user ID"
                    },
                    {
                        displayName: "Page",
                        name: "page",
                        type: "number",
                        default: 0,
                        description: "Page number to return"
                    },
                    {
                        displayName: "Start Date",
                        name: "start_date",
                        type: "string",
                        default: "",
                        description: "Filter for bookings starting on or after this date (yyyy-mm-dd)"
                    }
                ]
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-team-bookings"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Team",
                name: "team",
                type: "number",
                default: 0,
                required: true,
                description: "The ID of the team",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-team-users"
                        ]
                    }
                }
            },
            {
                displayName: "Page",
                name: "page",
                type: "number",
                default: 0,
                required: true,
                description: "Page number to return",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-team-users"
                        ]
                    }
                }
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-team-users"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            },
            {
                displayName: "Page",
                name: "page",
                type: "number",
                default: 0,
                required: true,
                description: "Page number to return",
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-teams"
                        ]
                    }
                }
            },
            {
                displayName: "Options",
                name: "options",
                type: "collection",
                placeholder: "Add Option",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "teams"
                        ],
                        operation: [
                            "list-teams"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Destination URL",
                        name: "server_documentServer1BaseurlTidycalComApi_baseUrl",
                        type: "string",
                        default: "https://api.example.com",
                        description: "HTTPS destination URL for the API",
                        placeholder: "https://api.example.com",
                        validateType: "url"
                    }
                ]
            }
        ]
    };

  public async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const output: INodeExecutionData[] = [];
    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
      const outputStart = output.length;
      let errorPlan: Record<string, { title: string; recovery?: string; parameter?: string }> = {};
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const nodeVersion = this.getNode().typeVersion;
        let additionalFields: IDataObject = {};
        const nodeOptions = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
        
        let retryContract: RetryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
        let credentialApplications: CredentialApplication[] | undefined;
        let options: IHttpRequestOptions;
        let pagination: PaginationContract = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        let responsePlan: { binary: boolean; full: boolean; envelopePath: string; itemPath: string; fields: string[]; simplified: string[] } = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        switch (operation) {
          case "get-account": {
        
        
        const path = "/me";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["currency_symbol","email","language","lifetime_pro_at","name","profile_picture_url","vanity_path"], simplified: ["currency_symbol","email","language","lifetime_pro_at","name","profile_picture_url","vanity_path"] };
        errorPlan = {};
        break;
      }
    case "create-booking": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/booking-types/{bookingType}/bookings";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{bookingType}").join(encodeURIComponent(String(this.getNodeParameter("bookingType", itemIndex))));
        if (additionalFields["booking_questions"] !== undefined) setBodyField(body as IDataObject, {"name":"booking_questions","displayName":"Booking questions","description":"Answers to the booking type’s questions.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"answer","displayName":"Answer","description":"Answer text, or an array of answers for a checkbox question.","type":"alternative","example":"My answer","composition":"oneOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"string"},{"name":"alternative2","displayName":"Alternative2","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}]},{"name":"booking_type_question_id","displayName":"Booking type question id","description":"ID of the booking type question.","type":"integer","example":1}]}}, additionalFields["booking_questions"], this, itemIndex);
    if (additionalFields["bookings"] !== undefined) setBodyField(body as IDataObject, {"name":"bookings","displayName":"Bookings","description":"Session start times for a package or multi-session booking; overrides starts_at when supplied.","type":"array","example":[{"starts_at":"2024-03-20T10:00:00Z"},{"starts_at":"2024-03-27T10:00:00Z"}],"representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"starts_at","displayName":"Starts at","description":"UTC start time for this booking session.","type":"string","format":"date-time","required":true,"example":"2024-03-20T10:00:00Z"}]}}, additionalFields["bookings"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"email","displayName":"Email","description":"Email address of the person booking.","type":"string","format":"email","required":true,"example":"john@example.com"}, this.getNodeParameter("email", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"name","displayName":"Name","description":"Name of the person booking.","type":"string","required":true,"example":"John Doe"}, this.getNodeParameter("name", itemIndex), this, itemIndex);
    if (additionalFields["starts_at"] !== undefined) setBodyField(body as IDataObject, {"name":"starts_at","displayName":"Starts at","description":"UTC start time for a single booking; ignored when bookings is supplied.","type":"string","format":"date-time","example":"2024-03-20T10:00:00Z"}, additionalFields["starts_at"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"timezone","displayName":"Timezone","description":"Time zone for the booking, such as America/Los_Angeles.","type":"string","required":true,"example":"America/Los_Angeles"}, this.getNodeParameter("timezone", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"403":{"title":"Forbidden - User does not have permission to create bookings for this booking type"},"409":{"title":"Conflict for unavailable slots, non-cancelled duplicates (same email, type, and slot; 5 minutes), or lock timeouts. Available-seat group types (max_bookings > 1, excluding polls and round-robin) use the lock wait (10 seconds default); subscription-credit bookings keep 5 minutes. Lock timeouts are retryable."},"422":{"title":"Validation Error"}};
        break;
      }
    case "create-booking-type": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/booking-types";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["approval_required"] !== undefined) setBodyField(body as IDataObject, {"name":"approval_required","displayName":"Approval required","type":"boolean","example":false,"nullable":true}, additionalFields["approval_required"], this, itemIndex);
    if (additionalFields["booking_availability_interval_minutes"] !== undefined) setBodyField(body as IDataObject, {"name":"booking_availability_interval_minutes","displayName":"Booking availability interval minutes","type":"integer","minValue":15,"maxValue":1440,"default":15,"example":30}, additionalFields["booking_availability_interval_minutes"], this, itemIndex);
    if (additionalFields["booking_threshold"] !== undefined) setBodyField(body as IDataObject, {"name":"booking_threshold","displayName":"Booking threshold","description":"Minimum booking notice in minutes. Omit for the 120-minute default; use 0 for no minimum.","type":"integer","minValue":0,"maxValue":15000,"example":120}, additionalFields["booking_threshold"], this, itemIndex);
    if (additionalFields["booking_type_category_id"] !== undefined) setBodyField(body as IDataObject, {"name":"booking_type_category_id","displayName":"Booking type category id","type":"integer","example":1,"nullable":true}, additionalFields["booking_type_category_id"], this, itemIndex);
    if (additionalFields["currency_code"] !== undefined) setBodyField(body as IDataObject, {"name":"currency_code","displayName":"Currency code","description":"ISO 4217 currency code; defaults to the account currency.","type":"string","example":"USD"}, additionalFields["currency_code"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"description","displayName":"Description","type":"string","format":"html","required":true,"example":"Book a 30 minute meeting with me"}, this.getNodeParameter("description", itemIndex), this, itemIndex);
    if (additionalFields["display_seats_remaining"] !== undefined) setBodyField(body as IDataObject, {"name":"display_seats_remaining","displayName":"Display seats remaining","type":"boolean","default":false,"example":false}, additionalFields["display_seats_remaining"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"duration_minutes","displayName":"Duration minutes","type":"integer","required":true,"minValue":1,"example":30}, this.getNodeParameter("duration_minutes", itemIndex), this, itemIndex);
    if (additionalFields["latest_availability_days"] !== undefined) setBodyField(body as IDataObject, {"name":"latest_availability_days","displayName":"Latest availability days","type":"integer","minValue":0,"maxValue":36500,"default":60,"example":90}, additionalFields["latest_availability_days"], this, itemIndex);
    if (additionalFields["max_bookings"] !== undefined) setBodyField(body as IDataObject, {"name":"max_bookings","displayName":"Max bookings","type":"integer","minValue":1,"default":1,"example":1}, additionalFields["max_bookings"], this, itemIndex);
    if (additionalFields["max_guest_invites_per_booker"] !== undefined) setBodyField(body as IDataObject, {"name":"max_guest_invites_per_booker","displayName":"Max guest invites per booker","type":"integer","minValue":0,"maxValue":10,"default":0,"example":0}, additionalFields["max_guest_invites_per_booker"], this, itemIndex);
    if (additionalFields["padding_minutes"] !== undefined) setBodyField(body as IDataObject, {"name":"padding_minutes","displayName":"Padding minutes","type":"integer","minValue":0,"default":0,"example":15}, additionalFields["padding_minutes"], this, itemIndex);
    if (additionalFields["payment_platform"] !== undefined) setBodyField(body as IDataObject, {"name":"payment_platform","displayName":"Payment platform","description":"Connected payment platform; required when price is greater than 0.","type":"string","enum":["stripe","paypal","tidycal"],"example":"stripe"}, additionalFields["payment_platform"], this, itemIndex);
    if (additionalFields["price"] !== undefined) setBodyField(body as IDataObject, {"name":"price","displayName":"Price","description":"Booking price; 0 is free. Currency controls precision: whole amounts for zero-decimal currencies, up to two decimals otherwise. Uses currency_code or the account currency.","type":"number","format":"float","minValue":0,"maxValue":99999999.99,"default":0,"example":25}, additionalFields["price"], this, itemIndex);
    if (additionalFields["private"] !== undefined) setBodyField(body as IDataObject, {"name":"private","displayName":"Private","type":"boolean","default":false,"example":false}, additionalFields["private"], this, itemIndex);
    if (additionalFields["redirect_url"] !== undefined) setBodyField(body as IDataObject, {"name":"redirect_url","displayName":"Redirect url","type":"string","example":"https://example.com/thank-you","nullable":true}, additionalFields["redirect_url"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"title","displayName":"Title","type":"string","required":true,"example":"30 Minute Meeting"}, this.getNodeParameter("title", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"url_slug","displayName":"Url slug","type":"string","required":true,"example":"30-minute-meeting"}, this.getNodeParameter("url_slug", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"422":{"title":"Validation Error"}};
        break;
      }
    case "list-booking-type-timeslots": {
        
        
        let path = "/booking-types/{bookingType}/timeslots";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{bookingType}").join(encodeURIComponent(String(this.getNodeParameter("bookingType", itemIndex))));
    qs["starts_at"] = this.getNodeParameter("starts_at", itemIndex);
    qs["ends_at"] = this.getNodeParameter("ends_at", itemIndex);
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "list-booking-types": {
        
        
        let path = "/booking-types";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{page}").join(encodeURIComponent(String(this.getNodeParameter("page", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "cancel-booking": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/bookings/{booking}/cancel";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{booking}").join(encodeURIComponent(String(this.getNodeParameter("booking", itemIndex))));
        if (additionalFields["reason"] !== undefined) setBodyField(body as IDataObject, {"name":"reason","displayName":"Reason","description":"Reason for cancelling the booking, if provided.","type":"string","example":"Client requested cancellation"}, additionalFields["reason"], this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["booking_type_id","cancelled_at","contact","contact_id","created_at","ends_at","id","meeting_id","meeting_url","payment","questions","starts_at","timezone","updated_at"], simplified: ["id","created_at","updated_at","booking_type_id","cancelled_at","contact_id","ends_at","meeting_id","meeting_url","starts_at"] };
        errorPlan = {"400":{"title":"Bad Request - Booking is already cancelled"},"403":{"title":"Forbidden - User does not have permission to cancel this booking"},"404":{"title":"Not Found - Booking not found"}};
        break;
      }
    case "get-booking": {
        
        
        let path = "/bookings/{booking}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{booking}").join(encodeURIComponent(String(this.getNodeParameter("booking", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["booking_type_id","cancelled_at","contact","contact_id","created_at","ends_at","id","meeting_id","meeting_url","payment","questions","starts_at","timezone","updated_at"], simplified: ["id","created_at","updated_at","booking_type_id","cancelled_at","contact_id","ends_at","meeting_id","meeting_url","starts_at"] };
        errorPlan = {"403":{"title":"Forbidden - User does not have permission to view this booking"},"404":{"title":"Not Found - Booking not found"},"422":{"title":"Validation Error"}};
        break;
      }
    case "list-bookings": {
        
        
        let path = "/bookings";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{starts_at}").join(encodeURIComponent(String(this.getNodeParameter("starts_at", itemIndex))));
    path = path.split("{ends_at}").join(encodeURIComponent(String(this.getNodeParameter("ends_at", itemIndex))));
    path = path.split("{cancelled}").join(encodeURIComponent(String(this.getNodeParameter("cancelled", itemIndex))));
    path = path.split("{page}").join(encodeURIComponent(String(this.getNodeParameter("page", itemIndex))));
    path = path.split("{include_teams}").join(encodeURIComponent(String(this.getNodeParameter("include_teams", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "create-contact": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/contacts";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"email","displayName":"Email","type":"string","format":"email","required":true,"example":"john@example.com"}, this.getNodeParameter("email", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string","required":true,"example":"John Doe"}, this.getNodeParameter("name", itemIndex), this, itemIndex);
    if (additionalFields["timezone"] !== undefined) setBodyField(body as IDataObject, {"name":"timezone","displayName":"Timezone","type":"string","example":"America/Los_Angeles"}, additionalFields["timezone"], this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"402":{"title":"Payment Required - Lifetime subscription required"},"422":{"title":"Validation Error"}};
        break;
      }
    case "list-contacts": {
        
        
        let path = "/contacts";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{page}").join(encodeURIComponent(String(this.getNodeParameter("page", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "add-team-user": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/teams/{team}/users";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{team}").join(encodeURIComponent(String(this.getNodeParameter("team", itemIndex))));
        setBodyField(body as IDataObject, {"name":"email","displayName":"Email","description":"Email address of the user to invite","type":"string","format":"email","required":true,"example":"user@example.com"}, this.getNodeParameter("email", itemIndex), this, itemIndex);
    if (additionalFields["role_name"] !== undefined) setBodyField(body as IDataObject, {"name":"role_name","displayName":"Role name","description":"Role name for the user in the team","type":"string","enum":["admin","user"],"example":"user"}, additionalFields["role_name"], this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["message","team_user_id"], simplified: ["message","team_user_id"] };
        errorPlan = {"403":{"title":"Forbidden - User does not have permission to add users to this team"},"404":{"title":"Not Found - Team not found"},"422":{"title":"Validation Error - User already invited or already a member"}};
        break;
      }
    case "create-team-booking-type": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/teams/{team}/booking-types";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{team}").join(encodeURIComponent(String(this.getNodeParameter("team", itemIndex))));
        if (additionalFields["approval_required"] !== undefined) setBodyField(body as IDataObject, {"name":"approval_required","displayName":"Approval required","type":"boolean","example":false,"nullable":true}, additionalFields["approval_required"], this, itemIndex);
    if (additionalFields["booking_availability_interval_minutes"] !== undefined) setBodyField(body as IDataObject, {"name":"booking_availability_interval_minutes","displayName":"Booking availability interval minutes","type":"integer","minValue":15,"maxValue":1440,"default":15,"example":30}, additionalFields["booking_availability_interval_minutes"], this, itemIndex);
    if (additionalFields["booking_threshold"] !== undefined) setBodyField(body as IDataObject, {"name":"booking_threshold","displayName":"Booking threshold","description":"Minimum booking notice in minutes. Omit for the 120-minute default; use 0 for no minimum.","type":"integer","minValue":0,"maxValue":15000,"example":120}, additionalFields["booking_threshold"], this, itemIndex);
    if (additionalFields["booking_type_category_id"] !== undefined) setBodyField(body as IDataObject, {"name":"booking_type_category_id","displayName":"Booking type category id","type":"integer","example":1,"nullable":true}, additionalFields["booking_type_category_id"], this, itemIndex);
    if (additionalFields["currency_code"] !== undefined) setBodyField(body as IDataObject, {"name":"currency_code","displayName":"Currency code","description":"ISO 4217 currency code; defaults to the account currency.","type":"string","example":"USD"}, additionalFields["currency_code"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"description","displayName":"Description","type":"string","format":"html","required":true,"example":"Book a 30 minute meeting with me"}, this.getNodeParameter("description", itemIndex), this, itemIndex);
    if (additionalFields["display_seats_remaining"] !== undefined) setBodyField(body as IDataObject, {"name":"display_seats_remaining","displayName":"Display seats remaining","type":"boolean","default":false,"example":false}, additionalFields["display_seats_remaining"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"duration_minutes","displayName":"Duration minutes","type":"integer","required":true,"minValue":1,"example":30}, this.getNodeParameter("duration_minutes", itemIndex), this, itemIndex);
    if (additionalFields["latest_availability_days"] !== undefined) setBodyField(body as IDataObject, {"name":"latest_availability_days","displayName":"Latest availability days","type":"integer","minValue":0,"maxValue":36500,"default":60,"example":90}, additionalFields["latest_availability_days"], this, itemIndex);
    if (additionalFields["max_bookings"] !== undefined) setBodyField(body as IDataObject, {"name":"max_bookings","displayName":"Max bookings","type":"integer","minValue":1,"default":1,"example":1}, additionalFields["max_bookings"], this, itemIndex);
    if (additionalFields["max_guest_invites_per_booker"] !== undefined) setBodyField(body as IDataObject, {"name":"max_guest_invites_per_booker","displayName":"Max guest invites per booker","type":"integer","minValue":0,"maxValue":10,"default":0,"example":0}, additionalFields["max_guest_invites_per_booker"], this, itemIndex);
    if (additionalFields["padding_minutes"] !== undefined) setBodyField(body as IDataObject, {"name":"padding_minutes","displayName":"Padding minutes","type":"integer","minValue":0,"default":0,"example":15}, additionalFields["padding_minutes"], this, itemIndex);
    if (additionalFields["payment_platform"] !== undefined) setBodyField(body as IDataObject, {"name":"payment_platform","displayName":"Payment platform","description":"Connected payment platform; required when price is greater than 0.","type":"string","enum":["stripe","paypal","tidycal"],"example":"stripe"}, additionalFields["payment_platform"], this, itemIndex);
    if (additionalFields["price"] !== undefined) setBodyField(body as IDataObject, {"name":"price","displayName":"Price","description":"Booking price; 0 is free. Currency controls precision: whole amounts for zero-decimal currencies, up to two decimals otherwise. Uses currency_code or the account currency.","type":"number","format":"float","minValue":0,"maxValue":99999999.99,"default":0,"example":25}, additionalFields["price"], this, itemIndex);
    if (additionalFields["private"] !== undefined) setBodyField(body as IDataObject, {"name":"private","displayName":"Private","type":"boolean","default":false,"example":false}, additionalFields["private"], this, itemIndex);
    if (additionalFields["redirect_url"] !== undefined) setBodyField(body as IDataObject, {"name":"redirect_url","displayName":"Redirect url","type":"string","example":"https://example.com/thank-you","nullable":true}, additionalFields["redirect_url"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"title","displayName":"Title","type":"string","required":true,"example":"30 Minute Meeting"}, this.getNodeParameter("title", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"url_slug","displayName":"Url slug","type":"string","required":true,"example":"30-minute-meeting"}, this.getNodeParameter("url_slug", itemIndex), this, itemIndex);
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"403":{"title":"Forbidden - User does not have permission to create booking types for this team"},"404":{"title":"Not Found - Team not found"},"422":{"title":"Validation Error"}};
        break;
      }
    case "get-team": {
        
        
        let path = "/teams/{team}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{team}").join(encodeURIComponent(String(this.getNodeParameter("team", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_at","id","name","updated_at"], simplified: ["created_at","id","name","updated_at"] };
        errorPlan = {"403":{"title":"Forbidden - User does not have permission to view this team"},"404":{"title":"Not Found - Team not found"}};
        break;
      }
    case "list-team-booking-types": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/teams/{team}/booking-types";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{team}").join(encodeURIComponent(String(this.getNodeParameter("team", itemIndex))));
    if (additionalFields["page"] !== undefined) qs["page"] = additionalFields["page"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"403":{"title":"Forbidden - User does not have permission to view this team"},"404":{"title":"Not Found - Team not found"}};
        break;
      }
    case "list-team-bookings": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/teams/{team}/bookings";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{team}").join(encodeURIComponent(String(this.getNodeParameter("team", itemIndex))));
    if (additionalFields["page"] !== undefined) qs["page"] = additionalFields["page"];
    if (additionalFields["start_date"] !== undefined) qs["start_date"] = additionalFields["start_date"];
    if (additionalFields["end_date"] !== undefined) qs["end_date"] = additionalFields["end_date"];
    if (additionalFields["email"] !== undefined) qs["email"] = additionalFields["email"];
    if (additionalFields["host_id"] !== undefined) qs["host_id"] = additionalFields["host_id"];
    if (additionalFields["cancelled"] !== undefined) qs["cancelled"] = additionalFields["cancelled"];
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"403":{"title":"Forbidden - User does not have permission to view this team"},"404":{"title":"Not Found - Team not found"}};
        break;
      }
    case "list-team-users": {
        
        
        let path = "/teams/{team}/users";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{team}").join(encodeURIComponent(String(this.getNodeParameter("team", itemIndex))));
    path = path.split("{page}").join(encodeURIComponent(String(this.getNodeParameter("page", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {"403":{"title":"Forbidden - User does not have permission to view this team"},"404":{"title":"Not Found - Team not found"}};
        break;
      }
    case "list-teams": {
        
        
        let path = "/teams";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{page}").join(encodeURIComponent(String(this.getNodeParameter("page", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
        errorPlan = {};
        break;
      }
    case "remove-team-user": {
        
        
        let path = "/teams/{team}/users/{teamUser}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{team}").join(encodeURIComponent(String(this.getNodeParameter("team", itemIndex))));
    path = path.split("{teamUser}").join(encodeURIComponent(String(this.getNodeParameter("teamUser", itemIndex))));
        
        
        const serverBaseUrl = resolveServerBaseUrl(this as never, [{"id":"documentServer1BaseurlTidycalComApi","url":"{baseUrl}//tidycal.com/api","kind":"selfHosted","variables":[{"name":"baseUrl","default":"https://api.example.com","enum":[]}]}], "documentServer1BaseurlTidycalComApi", nodeOptions, false);
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = undefined;
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["message"], simplified: ["message"] };
        errorPlan = {"403":{"title":"Forbidden - User does not have permission to remove users from this team"},"404":{"title":"Not Found - Team or team user not found"},"422":{"title":"Validation Error - User not found in team"}};
        break;
      }
          default: throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
        }
        const returnAll = pagination.style !== 'none' ? Boolean(nodeOptions.returnAll ?? false) : false;
    const resultLimit = pagination.style !== 'none' && !returnAll ? Number(nodeOptions.resultLimit ?? 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
    const pageStartTime = Date.now();
    const seenCursors = new Map<string, number>(); const seenPages = new Map<string, number>();
    let page = 1; let offset = 0; let cursor: unknown; let pagesFetched = 0; let estimatedBytes = 0; let finished = false;
    while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
      if (Date.now() - pageStartTime > pagination.maxElapsedMs) throw new NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
      const qs = options.qs as IDataObject;
      // Only the paginator's own page size is written here. It used to overwrite a
      // limit parameter the operation itself declared and the user had just set.
      if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined)) qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
      if (pagination.style === 'offset' && pagination.page) qs[pagination.page] = offset;
      if (pagination.style === 'pageNumber' && pagination.page) qs[pagination.page] = page;
      if (pagination.style === 'cursor' && pagination.cursor && cursor) qs[pagination.cursor] = cursor as string;
      const response = await requestWithRetry(this as never, options, credentialApplications, retryContract, itemIndex);
      pagesFetched += 1;
      const pageFingerprint = JSON.stringify(response);
      const pageRepeats = (seenPages.get(pageFingerprint) ?? 0) + 1;
      seenPages.set(pageFingerprint, pageRepeats);
      if (pageRepeats > pagination.repeatedPageLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
      estimatedBytes += pageFingerprint.length;
      if (estimatedBytes > pagination.maxMemoryBytes) throw new NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
      if (responsePlan.binary) {
        const binaryPayload = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
        const responseHeaders = (responsePlan.full ? ((response as IDataObject).headers as IDataObject | undefined) : undefined) ?? {};
        const contentType = String(responseHeaders['content-type'] ?? '').split(';')[0].trim() || 'application/octet-stream';
        // prepareBinaryData is what fills in fileName, fileSize and fileExtension.
        // Hand-building the binary entry produced items that downstream nodes could
        // not name or type, and discarded the response's own content type.
        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload as ArrayBuffer), undefined, contentType);
        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
        finished = true;
        continue;
      }
      const normalizedResponse = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
      const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
      if (responsePlan.envelopePath && envelopeValue === undefined) throw new NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
      const envelope = (envelopeValue ?? normalizedResponse) as IDataObject;
      const itemPath = pagination.itemPath || responsePlan.itemPath;
      const extractedItems = valueAtPath(envelope, itemPath);
      if (itemPath && extractedItems === undefined) throw new NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
      // A DELETE used to be reported as a fixed { deleted: true } with its body
      // thrown away, which lost the deleted representation and the job handle that
      // asynchronous deletes return. The body is used when there is one.
      const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse as IDataObject).length === 0));
      const values = deletedFallback
        ? [{ deleted: true }]
        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems ?? envelope];
      const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') as string : 'raw';
      const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) as string[] : [];
      for (const value of values) {
        if (output.length - outputStart >= resultLimit) break;
        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
        output.push({ json: selectResponseFields(value as IDataObject, fields), pairedItem: { item: itemIndex } });
      }
      if (!returnAll || pagination.style === 'none' || values.length === 0) { finished = true; continue; }
      if (pagination.hasMore && envelope[pagination.hasMore] === false) { finished = true; continue; }
      if (pagination.style === 'cursor') {
        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
        finished = !cursor;
        if (cursor) {
          const key = String(cursor);
          const repeats = (seenCursors.get(key) ?? 0) + 1;
          seenCursors.set(key, repeats);
          if (repeats > pagination.repeatedCursorLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
        }
      }
      if (pagination.advancement === 'offsetByItems') offset += values.length;
      if (pagination.advancement === 'incrementPage') page += 1;
    }
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
          continue;
        }
        if (error instanceof NodeApiError) {
          const status = String((error as unknown as { httpCode?: string; cause?: { statusCode?: number } }).httpCode ?? (error as unknown as { cause?: { statusCode?: number } }).cause?.statusCode ?? 'default');
          const planned = errorPlan[status] ?? errorPlan.default;
          if (planned) {
            const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
            const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
            throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex, message: planned.title, description });
          }
        }
        if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
      }
    }
    return [output];
  }
}
