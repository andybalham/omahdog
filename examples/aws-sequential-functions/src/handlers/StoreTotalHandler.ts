import AWS from 'aws-sdk';
import uuid from 'uuid';
import { IActivityRequestHandler } from '../omahdog/FlowHandlers';
import { FlowContext } from '../omahdog/FlowContext';
import { StoreTotalRequest as StoreTotalRequest, StoreTotalResponse as StoreTotalResponse } from '../exchanges/StoreTotalExchange';

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export class StoreTotalHandler implements IActivityRequestHandler<StoreTotalRequest, StoreTotalResponse> {

    // TODO 25Apr20: We need this class to expose something to say it requires a DynamoDb table
    // TODO 25Apr20: It would be the same for any other service, should we inject a set of declared services?

    private readonly _tableName: string;

    constructor(tableName: string) {
        this._tableName = tableName;
    }

    async handle(_flowContext: FlowContext, request: StoreTotalRequest): Promise<StoreTotalResponse> {

        const id = uuid.v4();

        const params: any = {
            TableName: this._tableName,
            Item: {
                id: id,
                result: request
            }
        };

        await dynamoDb.put(params).promise();

        return { id: id };
    }
}
