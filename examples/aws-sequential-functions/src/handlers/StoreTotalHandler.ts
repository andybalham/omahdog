import { IActivityRequestHandler } from '../omahdog/FlowHandlers';
import { FlowContext } from '../omahdog/FlowContext';

import { StoreTotalRequest, StoreTotalResponse } from '../exchanges/StoreTotalExchange';

import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import uuid = require('uuid');

export class StoreTotalHandler implements IActivityRequestHandler<StoreTotalRequest, StoreTotalResponse> {

    private readonly _documentClient?: DocumentClient;
    private readonly _tableName?: string;

    constructor(documentClient?: DocumentClient, tableName?: string) {
        this._documentClient = documentClient;
        this._tableName = tableName;
    }

    async handle(_flowContext: FlowContext, request: StoreTotalRequest): Promise<StoreTotalResponse> {

        if (this._documentClient === undefined) throw new Error('this._documentClient === undefined');
        if (this._tableName === undefined) throw new Error('this._tableName === undefined');

        const id = uuid.v4();

        const params: any = {
            TableName: this._tableName,
            Item: {
                id: id,
                result: request
            }
        };

        await this._documentClient.put(params).promise();

        return { id: id };
    }
}
