import uuid = require('uuid');

import { FlowContext, IActivityRequestHandler } from '../omahdog/FlowContext';
import { DynamoDBCrudResource } from '../omahdog-aws/AwsResources';

import { StoreTotalRequest, StoreTotalResponse } from '../exchanges/StoreTotalExchange';

export class StoreTotalHandler implements IActivityRequestHandler<StoreTotalRequest, StoreTotalResponse> {

    resources = {
        flowResultTable: new DynamoDBCrudResource,
    }

    async handle(flowContext: FlowContext, request: StoreTotalRequest): Promise<StoreTotalResponse> {

        this.resources.flowResultTable.throwErrorIfInvalid();

        const id = uuid.v4();

        const params: any = {
            TableName: this.resources.flowResultTable.tableName,
            Item: {
                id: id,
                result: request
            }
        };

        await this.resources.flowResultTable.client?.put(params).promise();

        return { id: id };
    }
}
