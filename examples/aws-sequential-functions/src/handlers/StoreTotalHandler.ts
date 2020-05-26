import uuid = require('uuid');

import { FlowContext, IActivityRequestHandler } from '../omahdog/FlowContext';
import { DynamoDbTableCrudService } from '../omahdog-aws/AwsServices';

import { StoreTotalRequest, StoreTotalResponse } from '../exchanges/StoreTotalExchange';

export class StoreTotalHandler implements IActivityRequestHandler<StoreTotalRequest, StoreTotalResponse> {

    services = {
        flowResultTable: new DynamoDbTableCrudService,
    }

    async handle(flowContext: FlowContext, request: StoreTotalRequest): Promise<StoreTotalResponse> {

        if (this.services.flowResultTable.documentClient === undefined) throw new Error('this.services.flowResultTable.documentClient === undefined');
        if (this.services.flowResultTable.tableName === undefined) throw new Error('this.services.flowResultTable.tableName === undefined');

        const id = uuid.v4();

        const params: any = {
            TableName: this.services.flowResultTable.tableName,
            Item: {
                id: id,
                result: request
            }
        };

        await this.services.flowResultTable.documentClient.put(params).promise();

        return { id: id };
    }
}
