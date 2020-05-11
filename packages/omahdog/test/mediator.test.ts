import { expect } from 'chai';
import { FlowContext, IActivityRequestHandler, RequestRouter } from '../src/FlowContext';

class ExampleActivityRequest {
    input: number;
}

class ExampleActivityResponse {
    output: number;
}

class ExampleHandler implements IActivityRequestHandler<ExampleActivityRequest, ExampleActivityResponse> {
    async handle(_flowContext: FlowContext, request: ExampleActivityRequest): Promise<ExampleActivityResponse> {
        return { output: request.input };
    }
}

describe('Handlers', () => {

    it('Handlers can send request to handler', async () => {

        const mediator = new RequestRouter();
        mediator.register(ExampleActivityRequest, ExampleActivityResponse, ExampleHandler);

        const request = new ExampleActivityRequest();
        request.input = 616;

        const context = FlowContext.newContext();
        context.requestRouter
            .register(ExampleActivityRequest, ExampleActivityResponse, ExampleHandler);

        const response = await context.sendRequest(ExampleActivityRequest, request) as ExampleActivityResponse;

        expect(response).to.be.not.null;
        expect(response.output).to.be.equal(request.input);
    });
});
