FROM node
WORKDIR /app
RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y ffmpeg
COPY package*.json .
RUN npm install
COPY . .
CMD ["npm", "start"]