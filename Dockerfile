FROM node
WORKDIR /app
RUN apt-get install -y ffmpeg
COPY package*.json .
RUN npm install
COPY . .
CMD ["npm", "start"]