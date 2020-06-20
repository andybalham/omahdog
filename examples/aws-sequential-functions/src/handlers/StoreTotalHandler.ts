import { FlowContext, IActivityRequestHandler } from '../omahdog/FlowContext';
import { DynamoDBCrudHandler } from '../omahdog-aws/AwsHandlers';
import { throwErrorIfInvalid } from '../omahdog-aws/samTemplateFunctions';

import { StoreTotalRequest, StoreTotalResponse } from '../exchanges/StoreTotalExchange';

export class StoreTotalHandler extends DynamoDBCrudHandler implements IActivityRequestHandler<StoreTotalRequest, StoreTotalResponse> {

    async handle(flowContext: FlowContext, request: StoreTotalRequest): Promise<StoreTotalResponse> {

        throwErrorIfInvalid(this, () => StoreTotalHandler.name);

        const id = await this.put({result: request});

        return { id: id };
    }
}
