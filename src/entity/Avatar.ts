import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";
import { Video } from "./Video";

@Entity()
export class Avatar {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  heygenId: string;

  @Column()
  name: string;


  @Column({
    default: "",
  })
  imageUrl: string;

  @Column()
  type: "avatar" | "talking_photo";

  @ManyToOne(() => User, (user) => user.avatars)
  user: User;

  @OneToMany(() => Video, (video) => video.avatar)
  videos: Video[];
}
