export function createWebURL() {
    if(!process.env['BASE_URL']) throw new Error("BASE_URL is not set.");

    return process.env['NODE_ENV'] === "development" ?
        `${process.env['BASE_URL']}:${process.env['PORT']}` :
        process.env['BASE_URL']!;
}