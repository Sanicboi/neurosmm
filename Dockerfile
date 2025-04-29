FROM node
WORKDIR /app
RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y ffmpeg
COPY package*.json .
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]