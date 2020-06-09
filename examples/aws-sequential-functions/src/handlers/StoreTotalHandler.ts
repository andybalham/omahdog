import uuid = require('uuid');

import { FlowContext, IActivityRequestHandler } from '../omahdog/FlowContext';
import { DynamoDBCrudService } from '../omahdog-aws/AwsServices';

import { StoreTotalRequest, StoreTotalResponse } from '../exchanges/StoreTotalExchange';

export class StoreTotalHandler implements IActivityRequestHandler<StoreTotalRequest, StoreTotalResponse> {

    services = {
        flowResultTable: new DynamoDBCrudService,
    }

    async handle(flowContext: FlowContext, request: StoreTotalRequest): Promise<StoreTotalResponse> {

        this.services.flowResultTable.throwErrorIfInvalid();

        const id = uuid.v4();

        const params: any = {
            TableName: this.services.flowResultTable.tableName,
            Item: {
                id: id,
                result: request
            }
        };

        await this.services.flowResultTable.client?.put(params).promise();

        return { id: id };
    }
}
