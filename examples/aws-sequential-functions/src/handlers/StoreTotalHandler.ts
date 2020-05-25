import { FlowContext, IActivityRequestHandler } from '../omahdog/FlowContext';

import { StoreTotalRequest, StoreTotalResponse } from '../exchanges/StoreTotalExchange';

import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import uuid = require('uuid');
import { DynamoDbTableCrudResource } from '../omahdog-aws/AwsResources';

export class StoreTotalHandler implements IActivityRequestHandler<StoreTotalRequest, StoreTotalResponse> {

    resources = {
        flowResultTable: new DynamoDbTableCrudResource,
    }

    async handle(flowContext: FlowContext, request: StoreTotalRequest): Promise<StoreTotalResponse> {

        if (this.resources.flowResultTable.documentClient === undefined) throw new Error('this.resources.flowResultTable.documentClient === undefined');
        if (this.resources.flowResultTable.tableName === undefined) throw new Error('this.resources.flowResultTable.tableName === undefined');

        const id = uuid.v4();

        const params: any = {
            TableName: this.resources.flowResultTable.tableName.value,
            Item: {
                id: id,
                result: request
            }
        };

        await this.resources.flowResultTable.documentClient.put(params).promise();

        return { id: id };
    }
}
