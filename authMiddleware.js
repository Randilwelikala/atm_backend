const authMiddleware = (req, res, next) => {
    const sessionUser = req.session.user;

    if (!sessionUser) {
        return res.status(401).json({ message: "Unauthorized - No session" });
    }

    const currentTime = Date.now();
    const sessionExpiry = sessionUser.expiresAt;

    if (currentTime > sessionExpiry) {
        req.session.destroy(() => {
            return res.status(401).json({ message: "Session expired" });
        });
    } else {
        next();
    }
};

module.exports = authMiddleware;
