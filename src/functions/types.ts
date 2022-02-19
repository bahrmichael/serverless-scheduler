export interface Owner {
    owner: string;
}

export interface HttpAuthorization {
    headerName: string;
    // don't show this in the frontend
    headerValue?: string;
}

export interface App {
    owner: string;
    name: string;
    description?: string;
    type: IntegrationType;
    created: number;
    id: string;
    endpoint: string;
    usagePlanId: string;
    // todo: move this to dedicated table/schema
    apiKey?: string;
    httpAuthorization?: HttpAuthorization;
    version?: AppVersion;
    sendBackFormat?: 'payload_field' | 'unwrap_json';
}

export enum AppVersion {
    A = '2022_01_07'
}

export enum IntegrationType {
    'REST' = 'REST',
    'SQS' = 'SQS',
}

export enum MessageStatus {
    'READY' = 'READY',
    'QUEUED' = 'QUEUED',
    'SENT' = 'SENT',
    'FAILED' = 'FAILED',
    'ABORTED' = 'ABORTED',
}

export interface Message {
    owner: string;
    appId: string;
    messageId: string;
    sendAt: string;
    status: MessageStatus;
    payload: any;
    created: string;
    /*
    We use the GSI1 for loading READY items. We populate it when inserting items, and clear the fields when we queue them.
    The PK is <owner>#<status> and the SK is <date>#<ULID>.
     */
    gsi1pk: string;
    gsi1sk: string;

    // We don't keep these fields here, because we load them just before releasing the message.
    // targetType: TargetType;
    // targetUrl: string;
    // httpAuthorization?: HttpAuthorization;

    errorCount?: number;
    version?: MessageVersion;
}

export enum MessageVersion {
    A = '2022_01_07'
}

export interface MessageLog {
    owner: string;
    appId: string;
    messageId: string;
    timestamp: string;
    data: {status: number, data: string};
    version?: MessageLogVersion;
}

export enum MessageLogVersion {
    A = '2022_01_07'
}

export enum ApiKeyRecordVersion {
    A = '2022_01_07'
}

export interface ApiKeyRecord {
    id: string;
    pk: string; // can be appId or owner
    apiKey: string;
    owner: string;
    active: boolean;
    created: string;
    apigwApiKeyId: string;
    apigwApiKeyValue: string;
    type: 'API_KEY' | 'ACCESS_TOKEN';
    usagePlanId?: string;
    appId?: string;
    version?: ApiKeyRecordVersion;
}

export enum ControlKeyRecordVersion {
    A = '2022_02_19'
}

export interface ControlKeyRecord {
    pk: string;
    controlKey: string;
    id: string;
    owner: string;
    active: boolean;
    created: string;
    apigwApiKeyId: string;
    apigwApiKeyValue: string;
    version: ControlKeyRecordVersion;
    usagePlanId?: string;
}