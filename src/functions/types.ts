export interface Owner {
    owner: string;
    apiKey: string;
    httpAuthorization?: string;
}

export enum MessageStatus {
    'READY' = 'READY',
    'QUEUED' = 'QUEUED',
    'SENT' = 'SENT',
    'FAILED' = 'FAILED',
}

export enum TargetType {
    'HTTPS' = 'HTTPS',
    // | 'SNS' | 'SQS'
}

export interface Message {
    owner: string;
    id: string;
    sendAt: string;
    status: MessageStatus;
    payload: string;
    /*
    We use the GSI1 for loading READY items. We populate it when inserting items, and clear the fields when we queue them.
    The PK is <owner>#<status> and the SK is <date>#<ULID>.
     */
    gsi1pk: string;
    gsi1sk: string;

    targetType: TargetType;
    targetUrl: string;

    errorCount?: number;

    // If a message requires authorization, we should pull that from a dedicated secure table, and not have it on every message.
    httpAuthorization?: string;
}