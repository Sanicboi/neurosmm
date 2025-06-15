import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";
import { Video } from "./Video";

@Entity()
export class Voice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  heygenId: string;

  @Column()
  name: string;

  @Column({
    default: false,
  })
  selected: boolean;

  @ManyToOne(() => User, (user) => user.voices)
  user: User;

  @OneToMany(() => Video, (video) => video.voice)
  videos: Video[];

  
}
