import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";


@Entity() 
export class Avatar {
    @PrimaryGeneratedColumn()
    id: number;
    
    @Column()
    heygenId: string;

    @Column()
    name: string;

    @Column({
        default: false
    })
    selected: boolean;

    @Column({
        default: ''
    })
    imageUrl: string;

    @Column()
    type: "avatar" | "talking_photo";

    @ManyToOne(() => User, (user) => user.avatars)
    user: User;
}