declare namespace Express {
  interface Request {
    id: string;
    user?: import("@kisaanbazar/shared").AuthenticatedUser;
  }
}
