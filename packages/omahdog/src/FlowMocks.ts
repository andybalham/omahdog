export class FlowMocks {

    private readonly _mockHandlers = new Map<string, (request: any) => any>();

    add<TReq, TRes>(stepName: string, mockHandler: (request: TReq) => TRes): FlowMocks {
        this._mockHandlers.set(stepName, mockHandler);
        return this;
    }

    getResponse(stepName: string, request: any): any {
        
        if (!this._mockHandlers.has(stepName)) {
            return undefined;
        }

        const mockHandler = this._mockHandlers.get(stepName);

        if (mockHandler === undefined) throw new Error('mockHandler is undefined');

        const mockResponse = mockHandler(request);

        return mockResponse;
    }
}