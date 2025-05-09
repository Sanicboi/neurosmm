import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";



@Entity()
export class Voice {
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
    
        @ManyToOne(() => User, (user) => user.voices)
        user: User;
}