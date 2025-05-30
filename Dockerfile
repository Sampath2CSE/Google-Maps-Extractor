# Use the official Apify SDK image with Node 20
FROM apify/actor-node:20

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies with updated flags
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --omit=optional --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version \
    && rm -r ~/.npm

# Copy source code
COPY . ./

# Run the actor
CMD npm start